[![Serverless Components](https://s3.amazonaws.com/assets.github.serverless/readme-serverless-components-3.gif)](http://serverless.com)

<br/>

<p align="center">
  <b><a href="https://github.com/serverless-components/website/tree/v1">Click Here for Version 1.0</a></b>
</p>

<br/>

**Serverless Website Component** ⎯⎯⎯ Instantly deploy static website on serverless infrastructure with zero configuration, powered by [Serverless Components](https://github.com/serverless/components/tree/cloud).

<br/>

- [x] **Zero Configuration** - Just let us know the component name, then just deploy.
- [x] **Fast Deployments** - Deploy your entire website or frontend in seconds.
- [x] **CDN, SSL & Custom Domains** - Comes with free CDN, SSL & custom domains out of the box.
- [x] **Team Collaboration** - Collaborate with your teamates with shared state and outputs.
- [x] **Built-in Monitoring** - Monitor your website right from the Serverless Dashboard.

<br/>


<img src="/assets/deploy-demo.gif" height="250" align="right">

1. [**Install**](#1-install)
2. [**Create**](#2-create)
3. [**Deploy**](#3-deploy)
4. [**Configure**](#4-configure)
5. [**Develop**](#5-develop)
6. [**Monitor**](#6-monitor)
7. [**Remove**](#7-remove)

&nbsp;

### 1. Install

To get started with component, install the latest version of the Serverless Framework:

```
$ npm install -g serverless
```
### 2. Create

You can easily create a new website instance just by using the following command and template url.

```
$ serverless create --template-url https://github.com/serverless/components/tree/cloud/templates/website
$ cd website
```

Then, create a new `.env` file in the root of the `website` directory right next to `serverless.yml`, and add your AWS access keys:

```
# .env
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

You should now have a directory that looks something like this:

```
|- src
  |- index.html
|- serverless.yml
|- .env
```

The source directory could either contain simple html files, or an entire built React/Vue app.


### 3. Deploy

<img src="/assets/deploy-debug-demo.gif" height="250" align="right">

Once you have the directory set up, you're now ready to deploy. Just run `serverless deploy` from within the directory containing the `serverless.yml` file.

Your first deployment might take a little while, but subsequent deployment would just take few seconds. For more information on what's going on during deployment, you could specify the `serverless deploy --debug` flag, which would view deployment logs in realtime.

<br/>

### 4. Configure

The Website component is a zero configuration component, meaning that it'll work out of the box with no configuration and sane defaults. With that said, there are still some optional configuration that you can specify.

Here's a complete reference of the `serverless.yml` file for the website component:

```yml
component: website               # (required) name of the component. In that case, it's website.
name: my-website                 # (required) name of your website component instance.
org: serverlessinc               # (optional) serverless dashboard org. default is the first org you created during signup.
app: my-app                      # (optional) serverless dashboard app. default is the same as the name property.
stage: dev                       # (optional) serverless dashboard stage. default is dev.

inputs:
  src: ./src                     # (optional) path to the source folder. default is a hello world html file.
  domain: serverless.com         # (optional) domain name. this could also be a subdomain.
  region: us-east-2              # (optional) aws region to deploy to. default is us-east-1.
```

Once you've chosen your configuration, run `serverless deploy` again (or simply just `serverless`) to deploy your changes.

### 5. Develop

Now that you've got your basic website up and running, it's time to develop that into a real world application. Instead of having to run `serverless deploy` everytime you make changes you wanna test, you could enable dev mode, which allows the CLI to watch for changes in your source directory as you develop, and deploy instantly on save. 

To enable dev mode, simply run the following command from within the directory containing the `serverless.yml` file:

```
$ serverless dev
```

### 6. Monitor

Anytime you need to know more about your running website instance, you can run the following command to view the most critical info. 

```
$ serverless info
```

This is especially helpful when you want to know the outputs of your instances so that you can reference them in another instance. It also shows you the status of your instance, when it was last deployed, and how many times it was deployed. You will also see a url where you'll be able to view more info about your instance on the Serverless Dashboard.

To digg even deeper, you can pass the `--debug` flag to view the state of your component instance in case the deployment failed for any reason. 

```
$ serverless info --debug
```

### 7. Remove

If you wanna tear down your entire website infrastructure that was created during deployment, just run the following command in the directory containing the `serverless.yml` file. 
```
$ serverless remove
```

The website component will then use all the data it needs from the built-in state storage system to delete only the relavent cloud resources that it created. Just like deployment, you could also specify a `--debug` flag for realtime logs from the website component running in the cloud.

```
$ serverless remove --debug
```
