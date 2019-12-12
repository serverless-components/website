const { Component } = require('@serverless/core')
const {
  generateId,
  getClients,
  ensureBucket,
  configureBucketForHosting,
  uploadDir,
  clearBucket,
  deleteBucket
} = require('./utils')

class Website extends Component {
  async deploy(inputs) {
    const config = {}

    config.name = this.state.name || inputs.name || `website-${generateId()}`
    config.region = inputs.region || 'us-east-1'
    config.url = `http://${config.name}.s3-website-${config.region}.amazonaws.com`
    config.src = inputs.src

    if (!config.src) {
      throw new Error('Unable to deploy website. Missing inputs.src.')
    }

    const clients = getClients(this.credentials.aws, config.region)

    await this.status(`Deploying Bucket`)
    await this.debug(`Deploying Bucket ${config.name} to region ${config.region}`)
    await ensureBucket(clients.regular, config.name, this)

    await this.status(`Deploying Website`)
    if (!this.state.name) {
      await this.debug(`Configuring bucket for hosting`)
      await this.debug(`Uploading Website files`)
      await Promise.all([
        configureBucketForHosting(clients.regular, config.name),
        uploadDir(clients.accelerated, config.name, config.src)
      ])
    } else {
      await this.debug(`Uploading Website files`)
      await uploadDir(clients.accelerated, config.name, config.src)
    }

    await this.debug(`Website ${config.name} was successfully deployed to region ${config.region}`)
    await this.status(`Website Deployed`)

    this.state.name = config.name
    this.state.region = config.region
    this.state.url = config.url
    await this.save()

    return { url: config.url }
  }

  async remove() {
    await this.status(`Removing Website`)
    if (Object.keys(this.state).length === 0) {
      await this.debug(`State is empty. Nothing to remove`)
      return {}
    }
    const config = this.state

    const clients = getClients(this.credentials.aws, this.state.region)

    await this.debug(`Clearing bucket ${config.name}`)
    await clearBucket(clients.accelerated, config.name)

    await this.debug(`Deleting bucket ${config.name} from the ${config.region} region`)
    await deleteBucket(clients.regular, config.name)

    await this.debug(`Website ${config.name} was successfully removed from region ${config.region}`)

    this.state = {}
    await this.save()

    await this.status(`Website Removed`)
    return {}
  }
}

module.exports = Website
