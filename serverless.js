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

  types() {
    return types
  }

  /*
   * Default
   */

  async default(inputs = {}) {
    this.context.status('Deploying')

    // Default to current working directory
    inputs.code = inputs.code || {}
    inputs.code.src = inputs.code.src ? path.resolve(inputs.code.src) : process.cwd()
    if (inputs.code.build) {
      inputs.code.build = path.join(inputs.code.src, inputs.code.build)
    }
    inputs.region = inputs.region || 'us-east-1'

    this.context.status(`Preparing AWS S3 Bucket`)
    this.context.debug(`Deploying website bucket in ${inputs.region}.`)

    const bucket = await this.load('@serverless/aws-s3')
    const bucketOutputs = await bucket({
      website: true,
      region: inputs.region
    })

    this.context.status(`Bundling environment variables`)
    this.context.debug(`Bundling website environment variables.`)

    let script = 'window.env = {};\n'
    inputs.env = inputs.env || {}
    for (const e in inputs.env) {
      // eslint-disable-line
      script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n` // eslint-disable-line
    }

    let envFilePath
    if (inputs.code.build) {
      envFilePath = path.join(inputs.code.build, 'env.js')
    } else {
      envFilePath = path.join(inputs.code.src, 'env.js')
    }

    await utils.writeFile(envFilePath, script)
    this.context.debug(`Website env written to file ${envFilePath}.`)

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      this.context.status('Building assets')
      this.context.debug(`Running ${inputs.code.hook} in ${inputs.code.src}.`)

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

    const dirToUploadPath = inputs.code.build || inputs.code.src

    this.context.debug(
      `Uploading website files from ${dirToUploadPath} to bucket ${bucketOutputs.name}.`
    )
    await bucket.upload({ dir: dirToUploadPath })

    this.state.url = `http://${bucketOutputs.name}.s3-website-${inputs.region}.amazonaws.com`
    await this.save()

    this.context.debug(`Website deployed successfully to URL: ${this.state.url}.`)

    const outputs = {
      url: this.state.url,
      env: inputs.env || {}
    }

    return outputs
  }

  /**
   * Remove
   */

  async remove() {
    this.context.status(`Removing`)

    this.context.debug(`removing website bucket.`)
    const bucket = await this.load('@serverless/aws-s3')
    await bucket.remove()

    this.state = {}
    await this.save()
    return {}
  }
}

module.exports = Website
