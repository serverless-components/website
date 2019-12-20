module.exports = {
  credentials: ['amazon_web_services'],
  functions: {
    default: {
      description: 'Deploys an instance of this component',
      inputs: [
        {
          name: 'code',
          type: 'code',
          required: true,
          description:
            'The directory which contains your website code, declared by an index.js file',
          defaultRuntime: 'nodejs10.x',
          runtimes: ['nodejs10.x', 'nodejs8.10']
        },
        {
          name: 'region',
          type: 'value',
          valueType: 'string',
          required: true,
          description: 'The AWS region this should be located in',
          default: 'us-east-1',
          options: [
            'us-east-1',
            'us-east-2',
            'us-west-1',
            'us-west-2',
            'ap-east-1',
            'ap-south-1',
            'ap-northeast-1',
            'ap-northeast-2',
            'ap-southeast-1',
            'ap-southeast-2',
            'ca-central-1',
            'cn-north-1',
            'cn-northwest-1',
            'eu-central-1',
            'eu-west-1',
            'eu-west-2',
            'eu-west-3',
            'eu-north-1',
            'sa-east-1',
            'us-gov-east-1',
            'us-gov-west-1'
          ]
        },
        {
          name: 'env',
          type: 'key_values',
          description: 'Variables you wish to be automatically bundled into your code',
          required: false
        }
      ],
      policy: (bucketName) => ({
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
    },
    remove: {
      description: 'Removes this instance of this component',
      inputs: {}
    }
  }
}
