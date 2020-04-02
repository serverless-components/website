const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const klawSync = require('klaw-sync')
const mime = require('mime-types')
const url = require('url')
const https = require('https')
const agent = new https.Agent({
  keepAlive: true
})

const log = (msg) => console.log(msg) // eslint-disable-line

const sleep = async (wait) => new Promise((resolve) => setTimeout(() => resolve(), wait))

const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

const getClients = (credentials, region) => {
  AWS.config.update({
    httpOptions: {
      agent
    }
  })

  const params = {
    region,
    credentials
  }

  return {
    s3: {
      // we need two S3 clients because creating/deleting buckets
      // is not available with the acceleration feature.
      regular: new AWS.S3(params),
      accelerated: new AWS.S3({ ...params, endpoint: `s3-accelerate.amazonaws.com` })
    },
    cf: new AWS.CloudFront(params),
    route53: new AWS.Route53(params),
    acm: new AWS.ACM({
      credentials,
      region: 'us-east-1' // ACM must be in us-east-1
    })
  }
}

const getNakedDomain = (domain) => {
  const domainParts = domain.split('.')
  const topLevelDomainPart = domainParts[domainParts.length - 1]
  const secondLevelDomainPart = domainParts[domainParts.length - 2]
  return `${secondLevelDomainPart}.${topLevelDomainPart}`
}

const shouldConfigureNakedDomain = (domain) => {
  if (!domain) {
    return false
  }
  if (domain.startsWith('www') && domain.split('.').length === 3) {
    return true
  }
  return false
}

const getConfig = (inputs, state) => {
  const config = {}
  config.bucketName = inputs.bucketName || state.bucketName || `website-${generateId()}`
  config.region = inputs.region || state.region || 'us-east-1'
  config.bucketUrl = `http://${config.bucketName}.s3-website-${config.region}.amazonaws.com`
  config.src = inputs.src

  config.distributionId = state.distributionId
  config.distributionUrl = state.distributionUrl
  config.distributionArn = state.distributionArn
  config.distributionOrigins = [config.bucketUrl]
  config.distributionDescription =
    inputs.distributionDescription || `Website distribution for bucket ${config.bucketName}`
  config.distributionDefaults = inputs.distributionDefaults

  config.domain = inputs.domain
  config.nakedDomain = inputs.domain ? getNakedDomain(inputs.domain) : null
  config.domainHostedZoneId = state.domainHostedZoneId
  config.certificateArn = state.certificateArn

  // if user input example.com, make sure we also setup www.example.com
  if (config.domain === config.nakedDomain) {
    config.domain = `www.${config.domain}`
  }

  return config
}

const accelerateBucket = async (clients, bucketName, accelerated) => {
  try {
    await clients.s3.regular
      .putBucketAccelerateConfiguration({
        AccelerateConfiguration: {
          Status: accelerated ? 'Enabled' : 'Suspended'
        },
        Bucket: bucketName
      })
      .promise()

    // sleep for a a second for propagation
    // otherwise we'd get "S3 Transfer Acceleration is not configured on this bucket" error
    await sleep(1000)
  } catch (e) {
    if (e.code === 'NoSuchBucket') {
      await sleep(2000)
      return accelerateBucket(clients, bucketName, accelerated)
    }
    throw e
  }
}

const bucketCreation = async (clients, Bucket) => {
  try {
    await clients.s3.regular.headBucket({ Bucket }).promise()
  } catch (e) {
    if (e.code === 'NotFound' || e.code === 'NoSuchBucket') {
      await sleep(2000)
      return bucketCreation(clients, Bucket)
    }
    throw new Error(e)
  }
}

const ensureBucket = async (clients, bucketName, instance) => {
  try {
    log(`Checking if bucket ${bucketName} exists.`)
    await clients.s3.regular.headBucket({ Bucket: bucketName }).promise()
  } catch (e) {
    if (e.code === 'NotFound') {
      log(`Bucket ${bucketName} does not exist. Creating...`)
      await clients.s3.regular.createBucket({ Bucket: bucketName }).promise()
      // there's a race condition when using acceleration
      // so we need to sleep for a couple seconds. See this issue:
      // https://github.com/serverless/components/issues/428
      log(`Bucket ${bucketName} created. Confirming it's ready...`)
      await bucketCreation(clients, bucketName)
      log(`Bucket ${bucketName} creation confirmed. Accelerating...`)
      await accelerateBucket(clients, bucketName, true)
    } else if (e.code === 'Forbidden' && e.message === null) {
      throw Error(`Forbidden: Invalid credentials or this AWS S3 bucket name may already be taken`)
    } else if (e.code === 'Forbidden') {
      throw Error(`Bucket name "${bucketName}" is already taken.`)
    } else {
      throw e
    }
  }
}

const upload = async (clients, params) => {
  try {
    return clients.s3.accelerated.upload(params).promise()
  } catch (e) {
    // if acceleration settings are still not ready
    // use the regular client
    if (e.message.includes('Transfer Acceleration is not configured')) {
      return clients.s3.regular.upload(params).promise()
    }
    throw e
  }
}

const uploadDir = async (clients, bucketName, zipPath, instance) => {
  // upload a simple website by default
  let dirPath = path.join(__dirname, '_src')

  // but if user provided src code, upload that instead
  if (zipPath) {
    dirPath = await instance.unzip(zipPath)
  }

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

    uploadItems.push(upload(clients, itemParams))
  })

  await Promise.all(uploadItems)
}

const configureBucketForHosting = async (clients, bucketName) => {
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
    await clients.s3.regular
      .putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(s3BucketPolicy)
      })
      .promise()

    await clients.s3.regular
      .putBucketCors({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [putPostDeleteHeadRule, getRule]
        }
      })
      .promise()

    await clients.s3.regular.putBucketWebsite(staticHostParams).promise()
  } catch (e) {
    if (e.code === 'NoSuchBucket') {
      await sleep(2000)
      return configureBucketForHosting(clients, bucketName)
    }
    throw e
  }
}

const clearBucket = async (clients, bucketName) => {
  try {
    const data = await clients.s3.accelerated.listObjects({ Bucket: bucketName }).promise()

    const items = data.Contents
    const promises = []

    for (var i = 0; i < items.length; i += 1) {
      var deleteParams = { Bucket: bucketName, Key: items[i].Key }
      const delObj = clients.s3.accelerated.deleteObject(deleteParams).promise()
      promises.push(delObj)
    }

    await Promise.all(promises)
  } catch (error) {
    if (error.code !== 'NoSuchBucket') {
      throw error
    }
  }
}

const deleteBucket = async (clients, bucketName) => {
  try {
    await clients.s3.regular.deleteBucket({ Bucket: bucketName }).promise()
  } catch (error) {
    if (error.code !== 'NoSuchBucket') {
      throw error
    }
  }
}

const getDomainHostedZoneId = async (clients, config) => {
  const hostedZonesRes = await clients.route53.listHostedZonesByName().promise()

  const hostedZone = hostedZonesRes.HostedZones.find(
    // Name has a period at the end, so we're using includes rather than equals
    (zone) => zone.Name.includes(config.nakedDomain)
  )

  if (!hostedZone) {
    log(`Domain ${config.nakedDomain} was not found in your AWS account. Skipping DNS operations.`)
    return
  }

  return hostedZone.Id.replace('/hostedzone/', '') // hosted zone id is always prefixed with this :(
}

const getCertificateArnByDomain = async (clients, config) => {
  const listRes = await clients.acm.listCertificates().promise()
  const certificate = listRes.CertificateSummaryList.find(
    (cert) => cert.DomainName === config.nakedDomain
  )
  return certificate && certificate.CertificateArn ? certificate.CertificateArn : null
}

const getCertificateValidationRecord = (certificate, domain) => {
  if (!certificate.DomainValidationOptions) {
    return null
  }
  const domainValidationOption = certificate.DomainValidationOptions.find(
    (option) => option.DomainName === domain
  )

  return domainValidationOption.ResourceRecord
}

const describeCertificateByArn = async (clients, certificateArn, domain) => {
  const res = await clients.acm.describeCertificate({ CertificateArn: certificateArn }).promise()
  const certificate = res && res.Certificate ? res.Certificate : null

  if (
    certificate.Status === 'PENDING_VALIDATION' &&
    !getCertificateValidationRecord(certificate, domain)
  ) {
    await sleep(1000)
    return describeCertificateByArn(clients, certificateArn, domain)
  }

  return certificate
}

const ensureCertificate = async (clients, config, instance) => {
  const wildcardSubDomain = `*.${config.nakedDomain}`

  const params = {
    DomainName: config.nakedDomain,
    SubjectAlternativeNames: [config.nakedDomain, wildcardSubDomain],
    ValidationMethod: 'DNS'
  }

  log(`Checking if a certificate for the ${config.nakedDomain} domain exists`)
  let certificateArn = await getCertificateArnByDomain(clients, config)

  if (!certificateArn) {
    log(`Certificate for the ${config.nakedDomain} domain does not exist. Creating...`)
    certificateArn = (await clients.acm.requestCertificate(params).promise()).CertificateArn
  }

  const certificate = await describeCertificateByArn(clients, certificateArn, config.nakedDomain)

  if (certificate.Status !== 'ISSUED') {
    const certificateValidationRecord = getCertificateValidationRecord(
      certificate,
      config.nakedDomain
    )
    // only validate if domain/hosted zone is found in this account
    if (config.domainHostedZoneId) {
      log(`Validating the certificate for the ${config.nakedDomain} domain.`)

      const recordParams = {
        HostedZoneId: config.domainHostedZoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: certificateValidationRecord.Name,
                Type: certificateValidationRecord.Type,
                TTL: 300,
                ResourceRecords: [
                  {
                    Value: certificateValidationRecord.Value
                  }
                ]
              }
            }
          ]
        }
      }
      await clients.route53.changeResourceRecordSets(recordParams).promise()
    } else {
      // if domain is not in account, let the user validate manually
      log(
        `Certificate for the ${config.nakedDomain} domain was created, but not validated. Please validate it manually.`
      )
      log(`Certificate Validation Record Name: ${certificateValidationRecord.Name} `)
      log(`Certificate Validation Record Type: ${certificateValidationRecord.Type} `)
      log(`Certificate Validation Record Value: ${certificateValidationRecord.Value} `)
    }
  } else {
    // if certificate status is ISSUED, mark it a as valid for CloudFront to use
    config.certificateValid = true
  }

  return certificateArn
}

const getOriginConfig = (origin) => {
  const originUrl = typeof origin === 'string' ? origin : origin.url

  const { hostname, pathname } = url.parse(originUrl)

  const originConfig = {
    Id: hostname,
    DomainName: hostname,
    CustomHeaders: {
      Quantity: 0,
      Items: []
    },
    OriginPath: pathname === '/' ? '' : pathname
  }

  if (originUrl.includes('s3')) {
    const bucketName = hostname.split('.')[0]
    originConfig.Id = bucketName
    originConfig.DomainName = `${bucketName}.s3.amazonaws.com`
    originConfig.S3OriginConfig = {
      OriginAccessIdentity: ''
    }
  } else {
    originConfig.CustomOriginConfig = {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy: 'https-only',
      OriginSslProtocols: {
        Quantity: 1,
        Items: ['TLSv1.2']
      },
      OriginReadTimeout: 30,
      OriginKeepaliveTimeout: 5
    }
  }

  return originConfig
}

function getForwardedValues(config = {}, defaults = {}) {
  const forwardDefaults = {
    cookies: 'none',
    queryString: false
  }
  const defaultValues = { ...forwardDefaults, ...defaults }
  const { cookies, queryString = defaultValues.queryString, headers, queryStringCacheKeys } = config

  // Cookies
  const forwardCookies = {
    Forward: defaultValues.cookies
  }

  if (typeof cookies === 'string') {
    forwardCookies.Forward = cookies
  } else if (Array.isArray(cookies)) {
    forwardCookies.Forward = 'whitelist'
    forwardCookies.WhitelistedNames = {
      Quantity: cookies.length,
      Items: cookies
    }
  }

  // Headers
  const forwardHeaders = {
    Quantity: 0,
    Items: []
  }

  if (typeof headers === 'string' && headers === 'all') {
    forwardHeaders.Quantity = 1
    forwardHeaders.Items = ['*']
  } else if (Array.isArray(headers)) {
    forwardHeaders.Quantity = headers.length
    forwardHeaders.Items = headers
  }

  // QueryStringCacheKeys
  const forwardQueryKeys = {
    Quantity: 0,
    Items: []
  }

  if (Array.isArray(queryStringCacheKeys)) {
    forwardQueryKeys.Quantity = queryStringCacheKeys.length
    forwardQueryKeys.Items = queryStringCacheKeys
  }

  return {
    QueryString: queryString,
    Cookies: forwardCookies,
    Headers: forwardHeaders,
    QueryStringCacheKeys: forwardQueryKeys
  }
}

const getCacheBehavior = (pathPattern, pathPatternConfig, originId) => {
  const {
    allowedHttpMethods = ['GET', 'HEAD'],
    ttl,
    compress = true,
    smoothStreaming = false,
    viewerProtocolPolicy = 'https-only',
    fieldLevelEncryptionId = ''
  } = pathPatternConfig

  return {
    ForwardedValues: getForwardedValues(pathPatternConfig.forward, {
      cookies: 'all',
      queryString: true
    }),
    MinTTL: ttl,
    PathPattern: pathPattern,
    TargetOriginId: originId,
    TrustedSigners: {
      Enabled: false,
      Quantity: 0
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Items: ['GET', 'HEAD'],
        Quantity: 2
      }
    },
    Compress: compress,
    SmoothStreaming: smoothStreaming,
    DefaultTTL: ttl,
    MaxTTL: ttl,
    FieldLevelEncryptionId: fieldLevelEncryptionId,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: []
    }
  }
}

const addLambdaAtEdgeToCacheBehavior = (cacheBehavior, lambdaAtEdgeConfig = {}) => {
  const validLambdaTriggers = [
    'viewer-request',
    'origin-request',
    'origin-response',
    'viewer-response'
  ]

  Object.keys(lambdaAtEdgeConfig).forEach((eventType) => {
    if (!validLambdaTriggers.includes(eventType)) {
      throw new Error(
        `"${eventType}" is not a valid lambda trigger. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-cloudfront-trigger-events.html for valid event types.`
      )
    }

    cacheBehavior.LambdaFunctionAssociations.Quantity =
      cacheBehavior.LambdaFunctionAssociations.Quantity + 1
    cacheBehavior.LambdaFunctionAssociations.Items.push({
      EventType: eventType,
      LambdaFunctionARN: lambdaAtEdgeConfig[eventType],
      IncludeBody: true
    })
  })
}

const parseInputOrigins = (origins) => {
  const distributionOrigins = {
    Quantity: 0,
    Items: []
  }

  const distributionCacheBehaviors = {
    Quantity: 0,
    Items: []
  }

  for (const origin of origins) {
    const originConfig = getOriginConfig(origin)

    distributionOrigins.Quantity = distributionOrigins.Quantity + 1
    distributionOrigins.Items.push(originConfig)

    if (typeof origin === 'object') {
      // add any cache behaviors
      for (const pathPattern in origin.pathPatterns) {
        const pathPatternConfig = origin.pathPatterns[pathPattern]
        const cacheBehavior = getCacheBehavior(pathPattern, pathPatternConfig, originConfig.Id)

        addLambdaAtEdgeToCacheBehavior(cacheBehavior, pathPatternConfig['lambda@edge'])

        distributionCacheBehaviors.Quantity = distributionCacheBehaviors.Quantity + 1
        distributionCacheBehaviors.Items.push(cacheBehavior)
      }
    }
  }

  return {
    Origins: distributionOrigins,
    CacheBehaviors: distributionCacheBehaviors
  }
}

const getDefaultCacheBehavior = (originId, defaults = {}) => {
  const {
    allowedHttpMethods = ['HEAD', 'GET'],
    forward = {},
    ttl = 0,
    compress = false,
    smoothStreaming = false,
    viewerProtocolPolicy = 'redirect-to-https',
    fieldLevelEncryptionId = ''
  } = defaults

  const defaultCacheBehavior = {
    TargetOriginId: originId,
    ForwardedValues: getForwardedValues(forward),
    TrustedSigners: {
      Enabled: false,
      Quantity: 0,
      Items: []
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    MinTTL: 0,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Quantity: 2,
        Items: ['HEAD', 'GET']
      }
    },
    SmoothStreaming: smoothStreaming,
    DefaultTTL: ttl,
    MaxTTL: 31536000,
    Compress: compress,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: []
    },
    FieldLevelEncryptionId: fieldLevelEncryptionId
  }

  addLambdaAtEdgeToCacheBehavior(defaultCacheBehavior, defaults['lambda@edge'])

  return defaultCacheBehavior
}

const createCloudFrontDistribution = async (clients, config) => {
  const params = {
    DistributionConfig: {
      CallerReference: String(Date.now()),
      DefaultRootObject: 'index.html',
      CustomErrorResponses: {
        Quantity: 2,
        Items: [
          {
            ErrorCode: 404,
            ErrorCachingMinTTL: 300,
            ResponseCode: '200',
            ResponsePagePath: '/index.html'
          },
          {
            ErrorCode: 403,
            ErrorCachingMinTTL: 300,
            ResponseCode: '200',
            ResponsePagePath: '/index.html'
          }
        ]
      },
      Comment: config.distributionDescription,
      Aliases: {
        Quantity: 0,
        Items: []
      },
      Origins: {
        Quantity: 0,
        Items: []
      },
      PriceClass: 'PriceClass_All',
      Enabled: true,
      HttpVersion: 'http2'
    }
  }

  const distributionConfig = params.DistributionConfig

  const { Origins, CacheBehaviors } = parseInputOrigins(config.distributionOrigins)

  distributionConfig.Origins = Origins

  // set first origin declared as the default cache behavior
  distributionConfig.DefaultCacheBehavior = getDefaultCacheBehavior(
    Origins.Items[0].Id,
    config.distributionDefaults
  )

  if (CacheBehaviors) {
    distributionConfig.CacheBehaviors = CacheBehaviors
  }

  // configure domain only if certificate is valid
  if (config.certificateValid) {
    distributionConfig.ViewerCertificate = {
      ACMCertificateArn: config.certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.1_2016',
      Certificate: config.certificateArn,
      CertificateSource: 'acm'
    }

    distributionConfig.Aliases = {
      Quantity: 1,
      Items: [config.domain]
    }

    if (shouldConfigureNakedDomain(config.domain)) {
      distributionConfig.Aliases.Quantity = 2
      distributionConfig.Aliases.Items.push(config.nakedDomain)
    }
  }

  const res = await clients.cf.createDistribution(params).promise()

  return {
    distributionId: res.Distribution.Id,
    distributionArn: res.Distribution.ARN,
    distributionUrl: res.Distribution.DomainName,
    distributionOrigins: config.distributionOrigins,
    distributionDefaults: config.distributionDefaults,
    distributionDescription: config.distributionDescription
  }
}

const updateCloudFrontDistribution = async (clients, config) => {
  // Update logic is a bit weird...
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property

  // 1. we gotta get the config first...
  // todo what if id does not exist?
  const params = await clients.cf.getDistributionConfig({ Id: config.distributionId }).promise()

  // 2. then add this property
  params.IfMatch = params.ETag

  // 3. then delete this property
  delete params.ETag

  // 4. then set this property
  params.Id = config.distributionId

  // 5. then make our changes
  params.DistributionConfig.Comment = config.distributionDescription

  const { Origins, CacheBehaviors } = parseInputOrigins(config.distributionOrigins)

  params.DistributionConfig.DefaultCacheBehavior = getDefaultCacheBehavior(
    Origins.Items[0].Id,
    config.DistributionDefaults
  )
  params.DistributionConfig.Origins = Origins

  if (CacheBehaviors) {
    params.DistributionConfig.CacheBehaviors = CacheBehaviors
  }

  if (config.certificateValid) {
    params.DistributionConfig.ViewerCertificate = {
      ACMCertificateArn: config.certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.1_2016',
      Certificate: config.certificateArn,
      CertificateSource: 'acm'
    }

    params.DistributionConfig.Aliases = {
      Quantity: 1,
      Items: [config.domain]
    }

    if (shouldConfigureNakedDomain(config.domain)) {
      params.DistributionConfig.Aliases.Quantity = 2
      params.DistributionConfig.Aliases.Items.push(config.nakedDomain)
    }
  }

  // 6. then finally update!
  const res = await clients.cf.updateDistribution(params).promise()

  return {
    distributionId: res.Distribution.Id,
    distributionArn: res.Distribution.ARN,
    distributionUrl: res.Distribution.DomainName,
    distributionOrigins: config.distributionOrigins,
    distributionDefaults: config.distributionDefaults,
    distributionDescription: config.distributionDescription
  }
}

const invalidateCloudfrontDistribution = async (clients, config) => {
  const params = {
    DistributionId: config.distributionId,
    InvalidationBatch: {
      CallerReference: String(Date.now()),
      Paths: {
        Quantity: 3,
        Items: ['/', '/index.html', '/*']
      }
    }
  }
  await clients.cf.createInvalidation(params).promise()
}

const configureDnsForCloudFrontDistribution = async (clients, config) => {
  const dnsRecordParams = {
    HostedZoneId: config.domainHostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: config.domain,
            Type: 'A',
            AliasTarget: {
              HostedZoneId: 'Z2FDTNDATAQYW2', // this is a constant that you can get from here https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
              DNSName: config.distributionUrl,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    }
  }

  if (shouldConfigureNakedDomain(config.domain)) {
    dnsRecordParams.ChangeBatch.Changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: config.nakedDomain,
        Type: 'A',
        AliasTarget: {
          HostedZoneId: 'Z2FDTNDATAQYW2', // this is a constant that you can get from here https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
          DNSName: config.distributionUrl,
          EvaluateTargetHealth: false
        }
      }
    })
  }

  return clients.route53.changeResourceRecordSets(dnsRecordParams).promise()
}

const disableCloudFrontDistribution = async (clients, distributionId) => {
  const params = await clients.cf.getDistributionConfig({ Id: distributionId }).promise()

  params.IfMatch = params.ETag

  delete params.ETag

  params.Id = distributionId

  params.DistributionConfig.Enabled = false

  const res = await clients.cf.updateDistribution(params).promise()

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: `https://${res.Distribution.DomainName}`
  }
}

const deleteCloudFrontDistribution = async (clients, distributionId) => {
  try {
    const res = await clients.cf.getDistributionConfig({ Id: distributionId }).promise()

    const params = { Id: distributionId, IfMatch: res.ETag }
    await clients.cf.deleteDistribution(params).promise()
  } catch (e) {
    if (e.code === 'DistributionNotDisabled') {
      await disableCloudFrontDistribution(clients, distributionId)
    } else {
      throw e
    }
  }
}

const removeDomainFromCloudFrontDistribution = async (clients, config) => {
  const params = await clients.cf.getDistributionConfig({ Id: config.distributionId }).promise()

  params.IfMatch = params.ETag

  delete params.ETag

  params.Id = config.distributionId

  params.DistributionConfig.Aliases = {
    Quantity: 0,
    Items: []
  }

  params.DistributionConfig.ViewerCertificate = {
    SSLSupportMethod: 'sni-only',
    MinimumProtocolVersion: 'TLSv1.1_2016'
  }

  const res = await clients.cf.updateDistribution(params).promise()

  return {
    distributionId: res.Distribution.Id,
    distributionArn: res.Distribution.ARN,
    distributionUrl: res.Distribution.DomainName,
    distributionOrigins: config.distributionOrigins,
    distributionDefaults: config.distributionDefaults,
    distributionDescription: config.distributionDescription
  }
}

const removeCloudFrontDomainDnsRecords = async (clients, config) => {
  const params = {
    HostedZoneId: config.domainHostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: 'DELETE',
          ResourceRecordSet: {
            Name: config.domain,
            Type: 'A',
            AliasTarget: {
              HostedZoneId: 'Z2FDTNDATAQYW2', // this is a constant that you can get from here https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
              DNSName: config.distributionUrl,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    }
  }

  if (shouldConfigureNakedDomain(config.domain)) {
    params.ChangeBatch.Changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: config.nakedDomain,
        Type: 'A',
        AliasTarget: {
          HostedZoneId: 'Z2FDTNDATAQYW2', // this is a constant that you can get from here https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
          DNSName: config.distributionUrl,
          EvaluateTargetHealth: false
        }
      }
    })
  }

  try {
    await clients.route53.changeResourceRecordSets(params).promise()
  } catch (e) {
    if (e.code !== 'InvalidChangeBatch' && e.code !== 'NoSuchHostedZone') {
      throw e
    }
  }
}

module.exports = {
  log,
  generateId,
  getClients,
  getConfig,
  bucketCreation,
  accelerateBucket,
  ensureBucket,
  uploadDir,
  configureBucketForHosting,
  clearBucket,
  deleteBucket,
  getDomainHostedZoneId,
  ensureCertificate,
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  invalidateCloudfrontDistribution,
  configureDnsForCloudFrontDistribution,
  deleteCloudFrontDistribution,
  removeDomainFromCloudFrontDistribution,
  removeCloudFrontDomainDnsRecords
}
