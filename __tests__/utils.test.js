const { createBucketPolicy } = require('../utils')

describe('createBucketPolicy', () => {
  const bucketName = 'bucket-name'

  it('should return the default policy', () => {
    const actual = createBucketPolicy(bucketName)

    expect(actual).toEqual({
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

  it('should return the merged policy', () => {
    const desiredPolicy = {
      Statement: [
        {
          Principal: '*'
        }
      ]
    }

    const actual = createBucketPolicy(bucketName, desiredPolicy)

    expect(actual).toEqual({
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
