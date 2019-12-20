const Serverless = require('../serverless')
const S3 = require('aws-sdk/clients/s3')
jest.mock('../utils')
const utilsMock = require('../utils')

describe('Serverless', () => {
  const bucketName = 'bucket-name'
  Serverless.prototype.load = jest.fn().mockResolvedValue(jest.fn().mockResolvedValue({}))
  const serverless = new Serverless()
  serverless.context.status = jest.fn()
  serverless.context.debug = jest.fn()
  serverless.context.credentials = { aws: {} }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('configures bucket for hosting', async () => {
    try {
      await serverless.default({
        bucketName
      })
    } catch {}

    expect(utilsMock.configureBucketForHosting).toHaveBeenCalledWith(expect.any(S3), bucketName, {})
  })

  it('configures bucket for hosting with user bucket policy', async () => {
    const policy = {
      Statement: [{ Principal: '*' }]
    }
    try {
      await serverless.default({
        bucketName,
        policy
      })
    } catch {}

    expect(utilsMock.configureBucketForHosting).toHaveBeenCalledWith(
      expect.any(S3),
      bucketName,
      policy
    )
  })
})
