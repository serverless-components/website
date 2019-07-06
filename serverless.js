const path = require('path')
const util = require('util')
const types = require('./serverless.types.js')
const exec = util.promisify(require('child_process').exec)
const { Component, utils } = require('@serverless/core')

/*
 * Website
 */

class Website extends Component {

  /**
   * Types
   */

  types() { return types }

  /*
   * Default
   */

  async default(inputs = {}) {

    inputs.code = inputs.code ? path.resolve(inputs.code) : null

    if (!inputs.code) {
      throw Error(`"code" is a required input.`)
    }

    const config = {
      code: inputs.code,
      region: inputs.region || 'us-east-1'
    }

    if (inputs.build && typeof inputs.build === 'object') {
      config.build = {
        dir: inputs.build.dir ? path.resolve(config.code, inputs.build.dir) : path.resolve(config.code, inputs.build.dir),
        envFile: inputs.build.envFile ? path.resolve(config.code, inputs.build.envFile) : path.resolve(config.code, 'env.js'),
        env: inputs.build.env || {},
        command: inputs.build.command || null
      }
    }

    this.context.status(`Deploying`)

    this.context.status(`Preparing AWS S3 Bucket`)
    const bucket = await this.load('@serverless/aws-s3')
    const bucketOutputs = await bucket({
      name: this.state.bucketName,
      website: true
    })

    this.context.status(`Bundling any environment variables`)
    if (typeof config.build === 'object' && Object.keys(config.build.env).length === 0) {
      let script = 'window.env = {};\n'
      for (const e in config.build.env) {
        // eslint-disable-line
        script += `window.env.${e} = ${JSON.stringify(config.build.env[e])};\n` // eslint-disable-line
      }
      await utils.writeFile(config.build.envFile, script)
    }

    // If a build command is provided, build the website...
    if (typeof config.build === 'object' && config.build.command) {
      this.context.status('Building assets')

      const options = { cwd: config.code }
      try {
        await exec(config.build.command, options)
      } catch (err) {
        console.error(err.stderr) // eslint-disable-line
        throw new Error(
          `Failed building website via "${
            config.build.command
          }".  View the output above for more information.`
        )
      }
    }

    this.context.status('Uploading')

    await bucket.upload({ dir: typeof config.build === 'object' ? config.build.dir : config.code })

    this.state.url = `http://${bucketOutputs.name}.s3-website-${config.region}.amazonaws.com`
    await this.save()

    const outputs = {
      url: this.state.url,
      env: []
    }

    if (typeof config.build === 'object' && Object.keys(config.build.env).length !== 0) {
      outputs.env = config.build.env
    }
    console.log(this.context)
    this.context.log()
    this.context.output('url', this.state.url)

    return outputs
  }

  async remove() {
    this.context.status(`Removing`)

    const bucket = await this.load('@serverless/aws-s3')
    await bucket.remove()

    this.state = {}
    await this.save()
    return {}
  }
}

module.exports = Website
