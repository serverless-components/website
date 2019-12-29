const { Component } = require('@serverless/core')
const {
  getClients,
  getConfig,
  ensureBucket,
  configureBucketForHosting,
  uploadDir,
  clearBucket,
  deleteBucket,
  getDomainHostedZoneId,
  ensureCertificate,
  updateCloudFrontDistribution,
  createCloudFrontDistribution,
  invalidateCloudfrontDistribution,
  configureDnsForCloudFrontDistribution,
  removeDomainFromCloudFrontDistribution,
  removeCloudFrontDomainDnsRecords,
  deleteCloudFrontDistribution
} = require('./utils')

class Website extends Component {
  async deploy(inputs) {
    let config = getConfig(inputs, this.state)

    const clients = getClients(this.credentials.aws, config.region)

    if (config.domain) {
      await this.status(`Initializing Domain`)
      await this.debug(`Setting up domain ${config.domain}`)

      if (!config.domainHostedZoneId) {
        this.state.domainHostedZoneId = await getDomainHostedZoneId(clients, config)
        await this.save()
        config.domainHostedZoneId = this.state.domainHostedZoneId
      }

      if (!config.certificateArn) {
        this.state.certificateArn = await ensureCertificate(clients, config, this)
        await this.save()
        config.certificateArn = this.state.certificateArn
      }
    }

    await this.status(`Deploying Bucket`)
    await this.debug(`Deploying Bucket ${config.bucketName} to region ${config.region}`)
    await ensureBucket(clients, config.bucketName, this)

    this.state.bucketName = config.bucketName
    this.state.region = config.region
    this.state.bucketUrl = config.bucketUrl
    await this.save()

    await this.status(`Deploying Website`)
    if (!this.state.configured) {
      await this.debug(`Configuring bucket for hosting`)
      await this.debug(`Uploading Website files`)
      await Promise.all([
        configureBucketForHosting(clients, config.bucketName),
        uploadDir(clients, config.bucketName, config.src)
      ])

      this.state.configured = true
      await this.save()
    } else {
      await this.debug(`Uploading Website files`)
      await uploadDir(clients, config.bucketName, config.src)
    }

    let newDistribution
    if (config.distributionId) {
      await this.debug(`Updating CloudFront distribution of ID ${config.distributionId}.`)
      newDistribution = await updateCloudFrontDistribution(clients, config)

      await this.debug(`Invalidating CloudFront cache for distribution ${config.distributionId}.`)
      await invalidateCloudfrontDistribution(clients, config)
    } else {
      await this.debug(`Creating CloudFront distribution in the ${config.region} region.`)
      newDistribution = await createCloudFrontDistribution(clients, config)
    }

    if (newDistribution) {
      this.state = { ...this.state, ...newDistribution }
      await this.save()
      config = { ...config, ...newDistribution }
    }

    if (config.domain && !this.state.domain) {
      await this.debug(`Configuring DNS records for domain "${config.domain}"`)
      await configureDnsForCloudFrontDistribution(clients, config)
      this.state.domain = config.domain
      this.state.nakedDomain = config.nakedDomain
      await this.save()
    }

    await this.debug(
      `Website with bucketName ${config.bucketName} was successfully deployed to region ${config.region}`
    )
    await this.status(`Website Deployed`)

    const outputs = {
      bucket: this.state.bucketName,
      url: `https://${this.state.distributionUrl}`
    }

    if (this.state.domain) {
      outputs.domain = `https://${this.state.domain}`
    }

    return outputs
  }

  async remove() {
    await this.status(`Removing Website`)
    if (Object.keys(this.state).length === 0) {
      await this.debug(`State is empty. Nothing to remove`)
      return {}
    }
    const config = this.state

    const clients = getClients(this.credentials.aws, this.state.region)

    await this.debug(`Clearing bucket ${config.bucketName}`)
    await clearBucket(clients, config.bucketName)

    await this.debug(`Deleting bucket ${config.bucketName} from the ${config.region} region`)
    await deleteBucket(clients, config.bucketName)

    if (this.state.domain) {
      await this.debug(
        `Removing domain "${this.state.domain}" from CloudFront distribution with ID ${this.state.distributionId}`
      )
      await removeDomainFromCloudFrontDistribution(clients, this.state)

      await this.debug(`Deleting DNS records for domain "${this.state.domain}"`)
      await removeCloudFrontDomainDnsRecords(clients, this.state)
    }

    if (this.state.distributionId) {
      await this.debug(`Deleting Cloudfront distribution ${this.state.distributionId}`)
      await deleteCloudFrontDistribution(clients, this.state.distributionId)
    }

    await this.debug(
      `Website ${config.bucketName} was successfully removed from region ${config.region}`
    )

    this.state = {}
    await this.save()

    await this.status(`Website Removed`)
    return {}
  }
}

module.exports = Website
