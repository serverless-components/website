const aws = require('aws-sdk')
const path = require('path')
const util = require('util')
const types = require('./serverless.types.js')
const exec = util.promisify(require('child_process').exec)
const { Component, utils } = require('@serverless/core')
const { configureBucketForHosting } = require('./utils')

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
    inputs.bucketName = inputs.name || this.state.bucketName || this.context.resourceId()

    this.context.status(`Preparing AWS S3 Bucket`)
    this.context.debug(`Deploying website bucket in ${inputs.region}.`)

    const domain = await this.load('@serverless/domain')

    const websiteBucket = await this.load('@serverless/aws-s3', 'websiteBucket')
    const bucketOutputs = await websiteBucket({
      name: inputs.bucketName,
      accelerated: false,
      region: inputs.region
    })

    const s3 = new aws.S3({ region: inputs.region, credentials: this.context.credentials.aws })

    this.context.debug(`Configuring bucket ${inputs.bucketName} for website hosting.`)
    await configureBucketForHosting(s3, inputs.bucketName)

    // Build environment variables
    if (inputs.env && Object.keys(inputs.env).length && inputs.code.src) {
      this.context.status(`Bundling environment variables`)
      this.context.debug(`Bundling website environment variables.`)
      let script = 'window.env = {};\n'
      inputs.env = inputs.env || {}
      for (const e in inputs.env) {
        // eslint-disable-line
        script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n` // eslint-disable-line
      }
      const envFilePath = path.join(inputs.code.src, 'env.js')
      await utils.writeFile(envFilePath, script)
      this.context.debug(`Website env written to file ${envFilePath}.`)
    }

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
          `Failed building website via "${inputs.code.hook}" due to the following error: "${err.stderr}"`
        )
      }
    }

    this.context.status('Uploading')

    const dirToUploadPath = inputs.code.build || inputs.code.src

    this.context.debug(
      `Uploading website files from ${dirToUploadPath} to bucket ${bucketOutputs.name}.`
    )

    await websiteBucket.upload({ dir: dirToUploadPath })

    this.state.bucketName = inputs.bucketName
    this.state.domain = inputs.domain
    this.state.region = inputs.region
    this.state.url = `http://${bucketOutputs.name}.s3-website-${inputs.region}.amazonaws.com`
    await this.save()

    this.context.debug(`Website deployed successfully to URL: ${this.state.url}.`)

    const outputs = {
      url: this.state.url,
      env: inputs.env || {}
    }

    if (inputs.domain) {
      let subdomain
      const secondLevelDomain = inputs.domain
        .split('.')
        .slice(inputs.domain.split('.').length - 2)
        .join('.')

      if (inputs.domain === secondLevelDomain) {
        subdomain = 'www'
      } else {
        subdomain = inputs.domain.split('.')[0]
      }

      const domainInputs = {
        domain: secondLevelDomain,
        subdomains: {}
      }

      domainInputs.subdomains[subdomain] = {
        url: outputs.url
      }

      const domainOutputs = await domain(domainInputs)

      outputs.domains = domainOutputs.domains
    }

    return outputs
  }

  /**
   * Remove
   */

  async remove() {
    this.context.status(`Removing`)

    this.context.debug(`removing website bucket.`)
    const websiteBucket = await this.load('@serverless/aws-s3', 'websiteBucket')
    await websiteBucket.remove()

    this.context.debug(`removing website domain.`)
    const domain = await this.load('@serverless/domain')
    await domain.remove()

    this.state = {}
    await this.save()
    return {}
  }
}

module.exports = Website
