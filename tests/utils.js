const { ServerlessSDK } = require('@serverless/platform-client')
require('dotenv').config()

/*
 * Pauses execution for an X period of time
 */
const sleep = async (wait) => new Promise((resolve) => setTimeout(() => resolve(), wait))

/*
 * Generate random id
 */
const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

/*
 * Fetches AWS credentials from the current environment
 * either from env vars, or .env file in the /tests directory
 */
const getCredentials = () => {
  const credentials = {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }

  if (!credentials.aws.accessKeyId || !credentials.aws.secretAccessKey) {
    throw new Error('Unable to run tests. AWS credentials not found in the envionrment')
  }

  return credentials
}

/*
 * Initializes and returns an instance of the serverless sdk
 * @param ${string} orgName - the serverless org name. Must correspond to the access key in the env
 */
const getServerlessSdk = (orgName) => {
  const sdk = new ServerlessSDK({
    accessKey: process.env.SERVERLESS_ACCESS_KEY,
    context: {
      orgName
    }
  })
  return sdk
}

module.exports = { sleep, generateId, getCredentials, getServerlessSdk }
