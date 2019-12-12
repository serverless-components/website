const aws = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const klawSync = require('klaw-sync')
const mime = require('mime-types')

const sleep = async (wait) => new Promise((resolve) => setTimeout(() => resolve(), wait))

const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

const getClients = (credentials, region) => {
  const params = {
    region,
    credentials
  }

  // we need two S3 clients because creating/deleting buckets
  // is not available with the acceleration feature.
  return {
    regular: new aws.S3(params),
    accelerated: new aws.S3({ ...params, endpoint: `s3-accelerate.amazonaws.com` })
  }
}

const accelerateBucket = async (s3, bucketName, accelerated) => {
  try {
    await s3
      .putBucketAccelerateConfiguration({
        AccelerateConfiguration: {
          Status: accelerated ? 'Enabled' : 'Suspended'
        },
        Bucket: bucketName
      })
      .promise()
  } catch (e) {
    if (e.code === 'NoSuchBucket') {
      await sleep(2000)
      return accelerateBucket(s3, bucketName, accelerated)
    }
    throw e
  }
}

const bucketCreation = async (s3, Bucket) => {
  try {
    await s3.headBucket({ Bucket }).promise()
  } catch (e) {
    if (e.code === 'NotFound' || e.code === 'NoSuchBucket') {
      await sleep(2000)
      return bucketCreation(s3, Bucket)
    }
    throw new Error(e)
  }
}

const ensureBucket = async (s3, name, instance) => {
  try {
    await instance.debug(`Checking if bucket ${name} exists.`)
    await s3.headBucket({ Bucket: name }).promise()
  } catch (e) {
    if (e.code === 'NotFound') {
      await instance.debug(`Bucket ${name} does not exist. Creating...`)
      await s3.createBucket({ Bucket: name }).promise()
      // there's a race condition when using acceleration
      // so we need to sleep for a couple seconds. See this issue:
      // https://github.com/serverless/components/issues/428
      await instance.debug(`Bucket ${name} created. Confirming it's ready...`)
      await bucketCreation(s3, name)
      await instance.debug(`Bucket ${name} creation confirmed. Accelerating...`)
      await accelerateBucket(s3, name, true)
    } else if (e.code === 'Forbidden' && e.message === null) {
      throw Error(`Forbidden: Invalid credentials or this AWS S3 bucket name may already be taken`)
    } else if (e.code === 'Forbidden') {
      throw Error(`Bucket name "${name}" is already taken.`)
    } else {
      throw e
    }
  }
}

const uploadDir = async (s3, bucketName, dirPath) => {
  const items = await new Promise((resolve, reject) => {
    try {
      resolve(klawSync(dirPath))
    } catch (error) {
      reject(error)
    }
  })

  const uploadItems = []
  items.forEach((item) => {
    if (item.stats.isDirectory()) {
      return
    }

    let key = path.relative(dirPath, item.path)
    // convert backslashes to forward slashes on windows
    if (path.sep === '\\') {
      key = key.replace(/\\/g, '/')
    }

    const itemParams = {
      Bucket: bucketName,
      Key: key,
      Body: fs.readFileSync(item.path),
      ContentType: mime.lookup(path.basename(item.path)) || 'application/octet-stream'
    }

    uploadItems.push(s3.upload(itemParams).promise())
  })

  await Promise.all(uploadItems)
}

const configureBucketForHosting = async (s3, bucketName) => {
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
      await sleep(2000)
      return configureBucketForHosting(s3, bucketName)
    }
    throw e
  }
}

const clearBucket = async (s3, bucketName) => {
  try {
    const data = await s3.listObjects({ Bucket: bucketName }).promise()

    const items = data.Contents
    const promises = []

    for (var i = 0; i < items.length; i += 1) {
      var deleteParams = { Bucket: bucketName, Key: items[i].Key }
      const delObj = s3.deleteObject(deleteParams).promise()
      promises.push(delObj)
    }

    await Promise.all(promises)
  } catch (error) {
    if (error.code !== 'NoSuchBucket') {
      throw error
    }
  }
}

const deleteBucket = async (s3, bucketName) => {
  try {
    await s3.deleteBucket({ Bucket: bucketName }).promise()
  } catch (error) {
    if (error.code !== 'NoSuchBucket') {
      throw error
    }
  }
}

module.exports = {
  generateId,
  getClients,
  bucketCreation,
  accelerateBucket,
  ensureBucket,
  uploadDir,
  configureBucketForHosting,
  clearBucket,
  deleteBucket
}
