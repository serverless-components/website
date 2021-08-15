const path = require('path')
const axios = require('axios')
const { generateId, getCredentials, getServerlessSdk } = require('./utils')

// set enough timeout for deployment to finish
jest.setTimeout(30000)

// the yaml file we're testing against
const instanceYaml = {
  org: process.env.ORG_NAME || 'serverlessinc',
  app: 'myapp',
  component: 'website@dev',
  name: `website-integration-tests-${generateId()}`,
  stage: 'dev',
  inputs: {} // should deploy with zero inputs
}

// store bucket url so that we can validate it on remove
let bucketUrl

// get aws credentials from env
const credentials = getCredentials()

// get serverless access key from env and construct sdk
const sdk = getServerlessSdk(instanceYaml.org)

// clean up the instance after tests
afterAll(async () => {
  // await sdk.remove(instanceYaml, credentials)
})

it.only('should successfully deploy website', async () => {
  const instance = await sdk.deploy(instanceYaml, credentials)

  // store the inital state for removal validation later on
  bucketUrl = instance.outputs.bucketUrl // eslint-disable-line

  expect(instance.outputs.url).toBeDefined()
  expect(instance.outputs.bucketUrl).toBeDefined()

  const response = await axios.get(instance.outputs.bucketUrl)

  // make sure website was actually deployed and is live
  expect(response.data).toContain('Hello Serverless')
})

it('should successfully update source code', async () => {
  // first deployment we did not specify source
  // we're now specifying our own source
  instanceYaml.inputs.src = path.resolve(__dirname, 'src')

  const instance = await sdk.deploy(instanceYaml, credentials)

  const response = await axios.get(instance.outputs.bucketUrl)

  // make sure it's the response we're expecting from the source we provided
  expect(response.data).toContain('Hello Again Serverless')
})

it('should successfully remove website', async () => {
  await sdk.remove(instanceYaml, credentials)

  try {
    await axios.get(bucketUrl)
    throw new Error('Website was not removed')
  } catch (e) {
    expect(e.message).toContain('Request failed with status code 404')
  }
})
