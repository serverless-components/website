const types = {
  functions: {
    default: {
      description: 'Deploys an instance of this component',
      inputs: {
        code: {
          description: 'The directory which contains your website code, declared by an index.js file',
          type: 'code',
          defaultRuntime: 'nodejs10.x',
          required: true,
          runtimes: [
            'nodejs10.x',
            'nodejs8.10',
          ]
        },
        region: {
          description: 'The AWS region this should be located in',
          type: 'arrayString',
          default: 'us-east-1',
          required: true,
          array: [
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
            'us-gov-west-1',
          ]
        },
        env: {
          description: 'The environment variables to bundle with your website',
          type: 'secrets',
          required: false,
        },
      },
    },
    remove: {
      description: 'Removes this instance of the website component',
      inputs: {}
    }
  }
}

module.exports = types
