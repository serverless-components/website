const { utils } = require('@serverless/core')
const { policy } = require('./serverless.types').functions.default
const merge = require('lodash/merge')

const createBucketPolicy = (bucketName, desiredPolicy = {}) => {
  const mergedPolicy = merge({}, policy(bucketName), desiredPolicy)
  return mergedPolicy
}

const configureBucketForHosting = async (s3, bucketName, configuredPolicy) => {
  try {
    await s3
      .putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(createBucketPolicy(bucketName, configuredPolicy))
      })
      .promise()

    const putPostDeleteHeadRule = {
      AllowedMethods: ['PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: ['https://*.amazonaws.com'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 0
    }

    const getRule = {
      AllowedMethods: ['GET'],
      AllowedOrigins: ['*'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 0
    }

    await s3
      .putBucketCors({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [putPostDeleteHeadRule, getRule]
        }
      })
      .promise()

    const staticHostParams = {
      Bucket: bucketName,
      WebsiteConfiguration: {
        ErrorDocument: {
          Key: 'index.html'
        },
        IndexDocument: {
          Suffix: 'index.html'
        }
      }
    }

    await s3.putBucketWebsite(staticHostParams).promise()
  } catch (e) {
    console.log('Error')
    if (e.code === 'NoSuchBucket') {
      await utils.sleep(2000)
      return configureBucketForHosting(s3, bucketName)
    }
    throw e
  }
}

module.exports = {
  configureBucketForHosting
}
