# website

&nbsp;

Deploy a static website to AWS S3 in seconds using [Serverless Components](https://github.com/serverless/components).

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)

&nbsp;

### 1. Install

```console
$ npm install -g serverless
```

### 2. Create

```console
$ mkdir my-website
$ cd my-website
```

the directory should look something like this:


```
|- code
  |- index.html
|- serverless.yml
|- .env      # your AWS api keys

```

```
# .env
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

The `code` directory could either be a simple directory of html/css/js assets files, or a full fledged React app.

### 3. Configure

```yml
# serverless.yml

name: my-website
stage: dev

myWebsite:
  component: "@serverless/website"
  inputs:
    code:
      root: ./ # The root folder of your website project.  Defaults to current working directory
      src: ./src # The folder to be uploaded containing your built artifact
      hook: npm run build # A hook to build/test/do anything to your code before uploading
    region: us-east-1 # The AWS region to deploy your website into
    bucketName: myBucket # (Optional) The Bucket name where `src` files/folder will be upload. 
                         # If not provided, it will create random bucket name and upload `src` files
    cloudFront: # (Optional)
        waitForCreateDistribution: true  # (Optional) wait for create cloudfront distribution to complete
        waitForUpdateDistribution: false # (Optional) wait for update cloudfront distribution to complete
        customOrigin: true # (Optional)  wait for custom origin to avoid s3 bucket redirect during cloudfront creation
    env: # Environment variables to include in a 'env.js' file with your uploaded code.
      API_URL: https://api.com
      
    # You can specify a custom domain name for your website.
    # You must have a public hosted zone available for this domain in AWS Route53.
    # This is done automatically for you if you've purchased the domain via AWS Route53.
    domain: www.example.com 
```

### 4. Deploy

```console
$ serverless

```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
