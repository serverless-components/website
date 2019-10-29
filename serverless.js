const aws = require('aws-sdk')
const path = require('path')
const util = require('util')
const types = require('./serverless.types.js')
const exec = util.promisify(require('child_process').exec)
const { Component, utils } = require('@serverless/core')
const {
  configureBucketForHosting,
  configureDomainForBucket,
  configureBucketForRedirect
} = require('./utils')

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
    this.context.debug(`Starting Website Component.`)

    // Default to current working directory
    inputs.code = inputs.code || {}
    inputs.code.root = inputs.code.root ? path.resolve(inputs.code.root) : process.cwd()
    if (inputs.code.src) {
      inputs.code.src = path.join(inputs.code.root, inputs.code.src)
    }
    inputs.region = inputs.region || 'us-east-1'
    inputs.bucketName = this.state.bucketName || inputs.bucketName || this.context.resourceId()

    this.context.status(`Preparing AWS S3 Bucket`)
    this.context.debug(`Preparing website AWS S3 bucket ${inputs.bucketName}.`)

    const websiteBucket = await this.load('@serverless/aws-s3', 'websiteBucket')
    const bucketOutputs = await websiteBucket({
      name: inputs.bucketName,
      accelerated: false,
      region: inputs.region
    })

    this.state.bucketName = inputs.bucketName
    await this.save()

    const s3 = new aws.S3({ region: inputs.region, credentials: this.context.credentials.aws })

    this.context.debug(`Configuring bucket ${inputs.bucketName} for website hosting.`)
    await configureBucketForHosting(s3, inputs.bucketName)

    // Build environment variables
    inputs.env = inputs.env || {}
    if (Object.keys(inputs.env).length && inputs.code.root) {
      this.context.status(`Bundling environment variables`)
      this.context.debug(`Bundling website environment variables.`)
      let script = 'window.env = {};\n'
 
      for (const e in inputs.env) {
        // eslint-disable-line
        script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n` // eslint-disable-line
      }
      const envFilePath = path.join(inputs.code.root, 'env.js')
      await utils.writeFile(envFilePath, script)
      this.context.debug(`Website env written to file ${envFilePath}.`)
    }

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      this.context.status('Building assets')
      this.context.debug(`Running ${inputs.code.hook} in ${inputs.code.root}.`)

      const options = { 
        cwd: inputs.code.root,
        // Merge input & process env variables to be available for hooks execution
        env: Object.assign(process.env, inputs.env),
      }

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

    const dirToUploadPath = inputs.code.src || inputs.code.root

    this.context.debug(
      `Uploading website files from ${dirToUploadPath} to bucket ${bucketOutputs.name}.`
    )

    await websiteBucket.upload({ dir: dirToUploadPath })

    this.state.bucketName = inputs.bucketName
    this.state.region = inputs.region
    this.state.url = `http://${bucketOutputs.name}.s3-website-${inputs.region}.amazonaws.com`
    await this.save()

    const outputs = {
      url: this.state.url,
      env: inputs.env || {}
    }

    // Configure custom domain, if specified
    if (inputs.domain) {
      const domain = await this.load('@serverless/domain')
      const subdomain = inputs.domain.split('.')[0]
      const secondLevelDomain = inputs.domain.replace(`${subdomain}.`, '')

      const domainInputs = {
        domain: secondLevelDomain,
        subdomains: {}
      }

      domainInputs.subdomains[subdomain] = { url: this.state.url }
      const domainOutputs = await domain(domainInputs)

      outputs.domain = domainOutputs.domains[0]
      this.state.domain = outputs.domain
      await this.save()
    }

    this.context.debug(`Website deployed successfully to URL: ${this.state.url}.`)

    return outputs
  }

  /**
   * Remove
   */

  async remove() {
    this.context.status(`Removing`)

    this.context.debug(`Starting Website Removal.`)
    this.context.debug(`Removing Website bucket.`)
    const websiteBucket = await this.load('@serverless/aws-s3', 'websiteBucket')
    await websiteBucket.remove()

    // Remove custom domain, if specified
    if (this.state.domain) {
      this.context.debug(`Removing custom domain.`)
      const domain = await this.load('@serverless/domain')
      await domain.remove()
    }

    this.state = {}
    await this.save()

    this.context.debug(`Finished Website Removal.`)
    return {}
  }
}

module.exports = Website
