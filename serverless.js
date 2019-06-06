const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { Component, writeFile } = require('@serverless/components')

const getBucketName = (websiteName) => {
  websiteName = websiteName.toLowerCase()
  const bucketId = Math.random()
    .toString(36)
    .substring(6)
  websiteName = `${websiteName}-${bucketId}`
  return websiteName
}

/*
 * Website
 */

class Website extends Component {
  /*
   * Default
   */

  async default(inputs = {}) {
    const config = {
      name: inputs.name || 'serverless',
      code: path.resolve(inputs.code || process.cwd()),
      region: inputs.region || 'us-east-1'
    }

    if (typeof inputs.build === 'object') {
      config.build = {
        dir: path.resolve(config.code, inputs.build.dir || './build'),
        envFile: path.resolve(config.code, inputs.build.envFile || path.join('src', 'env.js')),
        env: inputs.build.env || {},
        command: inputs.build.command || 'npm run build'
      }
    }

    const nameChanged = this.state.name && this.state.name !== config.name

    // get a globally unique bucket name
    // based on the passed in name
    config.bucketName =
      this.state.bucketName && !nameChanged ? this.state.bucketName : getBucketName(config.name)

    this.ui.status(`Deploying`)

    const bucket = await this.load('@serverless/aws-s3')

    await bucket({ name: config.bucketName, website: true })

    if (typeof config.build === 'object' && Object.keys(config.build.env).length === 0) {
      let script = 'window.env = {};\n'
      for (const e in config.build.env) {
        // eslint-disable-line
        script += `window.env.${e} = ${JSON.stringify(config.build.env[e])};\n` // eslint-disable-line
      }
      await writeFile(config.build.envFile, script)
    }

    // If a build command is provided, build the website...
    if (typeof config.build === 'object' && config.build.command) {
      this.ui.status('Building')

      const options = { cwd: config.code }
      try {
        await exec(config.build.command, options)
      } catch (err) {
        console.error(err.stderr) // eslint-disable-line
        throw new Error(
          `Failed building website via "${
            config.build.command
          }".  View the output above for more information.`
        )
      }
    }

    this.ui.status('Uploading')

    await bucket.upload({ dir: typeof config.build === 'object' ? config.build.dir : config.code })

    config.url = `http://${config.bucketName}.s3-website-${config.region}.amazonaws.com`

    this.state.name = config.name
    this.state.bucketName = config.bucketName
    this.state.url = config.url
    await this.save()

    const outputs = {
      url: this.state.url,
      env: []
    }

    if (typeof config.build === 'object' && Object.keys(config.build.env).length !== 0) {
      outputs.env = config.build.env
    }

    this.ui.log()
    this.ui.output('url', this.state.url)

    return outputs
  }

  async remove() {
    this.ui.status(`Removing`)

    const bucket = await this.load('@serverless/aws-s3')

    await bucket.remove()

    this.state = {}
    await this.save()
    return {}
  }
}

module.exports = Website
