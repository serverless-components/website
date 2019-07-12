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

    this.context.status('Deploying')

    // Default to current working directory
    inputs.code = inputs.code || {}
    inputs.code.src = inputs.code.src ? path.resolve(inputs.code.src) : process.cwd()
    if (inputs.code.build) inputs.code.build = path.join(inputs.code.src, inputs.code.build)

    let exists
    if (inputs.code.build) exists = await utils.fileExists(path.join(inputs.code.build, 'index.js'))
    else exists = await utils.fileExists(path.join(inputs.code.src, 'index.js'))

    if (!exists) {
      throw Error(`No index.js file found in the directory "${inputs.code.build || inputs.code.src}"`)
    }

    this.context.status(`Preparing AWS S3 Bucket`)

    const bucket = await this.load('@serverless/aws-s3')
    const bucketOutputs = await bucket({
      name: this.state.bucketName,
      website: true,
    })

    this.context.status(`Bundling environment variables`)
    let script = 'window.env = {};\n'
    inputs.env = inputs.env || {}
    for (const e in inputs.env) {
      // eslint-disable-line
      script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n` // eslint-disable-line
    }
    if (inputs.code.build) await utils.writeFile(path.join(inputs.code.build, 'env.js'), script)
    else await utils.writeFile(path.join(inputs.code.src, 'env.js'), script)

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      this.context.status('Building assets')

      const options = { cwd: inputs.code.src }
      try {
        await exec(inputs.code.hook, options)
      } catch (err) {
        console.error(err.stderr) // eslint-disable-line
        throw new Error(
          `Failed building website via "${
            inputs.code.hook
          }".  View the output above for more information.`
        )
      }
    }

    this.context.status('Uploading')

    await bucket.upload({ dir: inputs.code.build || inputs.code.src })

    this.state.url = `http://${bucketOutputs.name}.s3-website-${inputs.region}.amazonaws.com`
    await this.save()

    const outputs = {
      url: this.state.url,
      env: []
    }

    outputs.env = inputs.env || {}

    this.context.log()
    this.context.output('url', this.state.url)

    return outputs
  }

  /**
   * Remove
   */

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
