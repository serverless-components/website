[![Serverless Components](https://s3.amazonaws.com/public.assets.serverless.com/images/readme_serverless_website.gif)](http://serverless.com) -An Amazing Project

<br/>

<p align="center">
  <b><a href="https://github.com/serverless-components/website/tree/v1">Click Here for Version 1.0</a></b>
</p>

<br/>

**Serverless Website Component** ⎯⎯⎯ Instantly deploy static website on serverless infrastructure with zero configuration, powered by [Serverless Components](https://github.com/serverless/components).

<br/>

- [x] **Zero Configuration** - Just let us know the component name, then just deploy.
- [x] **Fast Deployments** - Deploy your entire website or frontend in seconds.
- [x] **CDN, SSL & Custom Domains** - Comes with free CDN, SSL & custom domains out of the box.
- [x] **Team Collaboration** - Collaborate with your teamates with shared state and outputs.
- [x] **Built-in Monitoring** - Monitor your website right from the Serverless Dashboard.

<br/>

Check out the **[Serverless Fullstack Application](https://github.com/serverless-components/fullstack-app)** for a ready-to-use boilerplate and overall great example of how to use this Component.

<br/>


<img src="/assets/deploy-demo.gif" height="250" align="right">

* [**Install**](#install)
* [**Initialize**](#init)
* [**Deploy**](#deploy)
* [**Configure**](#configure)
* [**Dev Mode**](#dev-mode)
* [**Get Info**](#get-info)
* [**Remove**](#remove)
* [**FAQs**](#faqs)

&nbsp;

### Install

To get started with component, install the latest version of the Serverless Framework:

```
$ npm install -g serverless
```
### Initialize

The easiest way to start using the website component is by initializing one of its templates using the `init` command:

For **React**:

```
serverless init react-starter
cd react-starter
```

For **Vue**:

```
serverless init vue-starter
cd vue starter
```

This will also run `npm install` for you, and create an empty `.env` file. Open that `.env` file and can add in your AWS credentials:

```
# .env
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

### Deploy

Once you have the directory set up, you're now ready to deploy. Just run the following command from within the directory containing the `serverless.yml` file:

```
$ serverless deploy
```

Your first deployment might take a little while, but subsequent deployment would just take few seconds. For more information on what's going on during deployment, you could specify the `--debug` flag, which would view deployment logs in realtime:

```
$ serverless deploy --debug
```

### Configure

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
  bucketName: my-bucket          # (optional) aws bucket name. default is an auto generated name.
  indexDocument: index.html      # (optional) index document for your website. default is index.html.
  errorDocument: index.html      # (optional) error document for your website. default is index.html.
```

You could also provide a build hook to run before the source gets uploaded by turning the `src` input into an object:

```yml

inputs:
  src:
    src: ./src          # the input source folder
    hook: npm run build # the hook you want to run
    dist: ./dist        # the output dist folder
```

Once you've chosen your configuration, run `serverless deploy` again (or simply just `serverless`) to deploy your changes.

### Dev Mode

Now that you've got your basic website up and running, it's time to develop that into a real world application. Instead of having to run `serverless deploy` everytime you make changes you wanna test, you could enable dev mode, which allows the CLI to watch for changes in your source directory as you develop, and deploy instantly on save. 

To enable dev mode, simply run the following command from within the directory containing the `serverless.yml` file:

```
$ serverless dev
```

### Get Info

Anytime you need to know more about your running website instance, you can run the following command to view the most critical info. 

```
$ serverless info
```

This is especially helpful when you want to know the outputs of your instances so that you can reference them in another instance. It also shows you the status of your instance, when it was last deployed, and how many times it was deployed. You will also see a url where you'll be able to view more info about your instance on the Serverless Dashboard.

To digg even deeper, you can pass the `--debug` flag to view the state of your component instance in case the deployment failed for any reason. 

```
$ serverless info --debug
```

### Remove

If you wanna tear down your entire website infrastructure that was created during deployment, just run the following command in the directory containing the `serverless.yml` file. 
```
$ serverless remove
```

The website component will then use all the data it needs from the built-in state storage system to delete only the relavent cloud resources that it created. Just like deployment, you could also specify a `--debug` flag for realtime logs from the website component running in the cloud.

```
$ serverless remove --debug
```

### FAQs

#### What AWS Resources Does This Component Create?

- AWS S3 Bucket for hosting
- AWS CloudFront for CDN

And if you set a domain:
- AWS ACM Certificate for SSL
- AWS Route53 for DNS

#### How to use a custom domain registered outside of AWS?
If your domain is not on AWS Route53, you will have to set this up manually because the component does not have access to your registrar. Here are the general steps involved.

1. Create an AWS ACM certificate for your domain. Make sure you set the "Additional Names" field to `*.yourdomain.com` as well to include all subdomains as well.
2. After you create the certificate, it should be in a `PENDING_VALIDATION` status. Now you will need to validate your domain. We suggest you follow the DNS steps by adding the validation CNAME record you see on the AWS console to your domain via your registrar dashboard.
3. After you add the validation record, it might take a while, but eventually the certificate should change status to `ISSUED`. Usually it takes around 5 minutes.
4. Add your domain to the `serverless.yml` file as shown above and deploy. This step is important as it adds your domain to the cloudfront distribution.
5. Notice the cloudfront url that is returned as an output. Copy this URL, get back to your registrar and add another CNAME record with your domain or subdomain name and a value of this cloudfront url. This ensures that your domain points to that cloudfront URL.
6. After around 20 mins, your SSL certificate and domain should all be working and pointing to your URL. Keep in mind that if you change the `name`, `stage`, `app` or `org` properties in `serverless.yml`, this would result in a completely new instance with a new cloudfront url. This allows you to setup different domains for each stage or instance
