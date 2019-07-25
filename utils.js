const s3WebsiteEndpoints = {
  'us-east-1': {
    endpoint: 's3-website-us-east-1.amazonaws.com',
    hostedZoneId: 'Z3AQBSTGFYJSTF'
  },
  'us-east-2': {
    endpoint: 's3-website.us-east-2.amazonaws.com',
    hostedZoneId: 'Z2O1EMRO9K5GLX'
  },
  'us-west-1': {
    endpoint: 's3-website-us-west-1.amazonaws.com',
    hostedZoneId: 'Z2F56UZL2M1ACD'
  },
  'us-west-2': {
    endpoint: 's3-website-us-west-2.amazonaws.com',
    hostedZoneId: 'Z3BJ6K6RIION7M'
  },
  'ap-east-1': {
    endpoint: 's3-website.ap-east-1.amazonaws.com',
    hostedZoneId: 'ZNB98KWMFR0R6'
  },
  'ap-south-1': {
    endpoint: 's3-website.ap-south-1.amazonaws.com',
    hostedZoneId: 'Z11RGJOFQNVJUP'
  },
  'ap-northeast-3': {
    endpoint: 's3-website.ap-northeast-3.amazonaws.com',
    hostedZoneId: 'Z2YQB5RD63NC85'
  },
  'ap-northeast-2': {
    endpoint: 's3-website.ap-northeast-2.amazonaws.com',
    hostedZoneId: 'Z3W03O7B5YMIYP'
  },
  'ap-southeast-1': {
    endpoint: 's3-website-ap-southeast-1.amazonaws.com',
    hostedZoneId: 'Z3O0J2DXBE1FTB'
  },
  'ap-southeast-2': {
    endpoint: 's3-website-ap-southeast-2.amazonaws.com',
    hostedZoneId: 'Z1WCIGYICN2BYD'
  },
  'ap-northeast-1': {
    endpoint: 's3-website-ap-northeast-1.amazonaws.com',
    hostedZoneId: 'Z2M4EHUR26P7ZW'
  },
  'ca-central-1': {
    endpoint: 's3-website.ca-central-1.amazonaws.com',
    hostedZoneId: 'Z1QDHH18159H29'
  },
  'eu-central-1': {
    endpoint: 's3-website.eu-central-1.amazonaws.com',
    hostedZoneId: 'Z21DNDUVLTQW6Q'
  },
  'eu-west-1': {
    endpoint: 's3-website-eu-west-1.amazonaws.com',
    hostedZoneId: 'Z1BKCTXD74EZPE'
  },
  'eu-west-2': {
    endpoint: 's3-website.eu-west-2.amazonaws.com',
    hostedZoneId: 'Z3GKZC51ZF0DB4'
  },
  'eu-west-3': {
    endpoint: 's3-website.eu-west-3.amazonaws.com',
    hostedZoneId: 'Z3R1K369G5AVDG'
  },
  'eu-north-1': {
    endpoint: 's3-website.eu-north-1.amazonaws.com',
    hostedZoneId: 'Z3BAZG2TWCNX0D'
  },
  'sa-east-1': {
    endpoint: 's3-website-sa-east-1.amazonaws.com',
    hostedZoneId: 'Z7KQH4QJS55SO'
  }
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
        Key: 'error.html'
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
}

const configureBucketForRedirect = async (s3, bucketName, destinationBucketName) => {
  const params = {
    Bucket: bucketName,
    WebsiteConfiguration: {
      RedirectAllRequestsTo: {
        HostName: destinationBucketName
      }
    }
  }

  await s3.putBucketWebsite(params).promise()
}

const configureDomainForBucket = async (route53, domain, region, action = 'UPSERT') => {
  const parentDomain = domain
    .split('.')
    .slice(domain.split('.').length - 2)
    .join('.')

  const hostedZonesRes = await route53.listHostedZonesByName().promise()

  const hostedZone = hostedZonesRes.HostedZones.find((zone) => zone.Name.includes(parentDomain))

  if (!hostedZone) {
    throw Error(
      `Domain ${parentDomain} was not found in your AWS account. Please purchase it from Route53 first then try again.`
    )
  }

  const hostedZoneId = hostedZone.Id.replace('/hostedzone/', '')

  const params = {
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: action,
          ResourceRecordSet: {
            Name: domain,
            Type: 'A',
            AliasTarget: {
              HostedZoneId: s3WebsiteEndpoints[region].hostedZoneId,
              DNSName: s3WebsiteEndpoints[region].endpoint,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    }
  }

  return route53.changeResourceRecordSets(params).promise()
}

module.exports = {
  configureBucketForHosting,
  configureBucketForRedirect,
  configureDomainForBucket
}
