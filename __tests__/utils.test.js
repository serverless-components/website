const { configureBucketForHosting } = require('../utils')

const bucketName = 'bucket-name'
const promiseFn = () => ({ promise: async () => {} })
const bucketPolicyFn = jest.fn(promiseFn)

const s3 = {
  putBucketPolicy: bucketPolicyFn,
  putBucketCors: promiseFn,
  putBucketWebsite: promiseFn
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('configureBucketForHosting', () => {
  it('should call s3 with default bucket policy', async () => {
    await configureBucketForHosting(s3, bucketName)

    expect(bucketPolicyFn).toHaveBeenCalledWith({
      Bucket: bucketName,
      Policy: JSON.stringify({
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
      })
    })
  })

  it('should call s3 with user configured bucket policy', async () => {
    const userConfiguredBucketPolicy = {
      Statement: [
        {
          Principal: '*'
        }
      ]
    }
    await configureBucketForHosting(s3, bucketName, userConfiguredBucketPolicy)

    expect(bucketPolicyFn).toHaveBeenCalledWith({
      Bucket: bucketName,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      })
    })
  })
})
