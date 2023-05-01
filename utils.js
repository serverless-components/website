const { utils } = require('@serverless/core')

const configureBucketForHosting = async (s3, bucketName) => {
  const publicAccessBlockConfig = {
    BlockPublicAcls: false,
    BlockPublicPolicy: false,
    IgnorePublicAcls: false,
    RestrictPublicBuckets: false
  }

  const s3BucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: {
          AWS: '*'
        },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/*`]
      }
    ]
  }
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

  try {
    await s3
      .putPublicAccessBlock({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: publicAccessBlockConfig
      })
      .promise()

    await s3
      .putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(s3BucketPolicy)
      })
      .promise()

    await s3
      .putBucketCors({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [putPostDeleteHeadRule, getRule]
        }
      })
      .promise()

    await s3.putBucketWebsite(staticHostParams).promise()
  } catch (e) {
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
