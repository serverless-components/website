# Serverless Website

&nbsp;

Deploy a static website to AWS S3 in seconds using [Serverless Components](https://github.com/serverless/components).

&nbsp;

1. [Install](#1-install)
2. [Login](#2-login)
3. [Create](#3-create)
4. [Configure](#4-configure)
5. [Deploy](#5-deploy)
6. [Info](#6-info)
7. [Remove](#7-remove)

&nbsp;

### 1. Install

```console
$ npm install -g serverless@components
```

### 2. Login

```console
$ serverless login
```

### 3. Create

```console
$ mkdir my-website
$ cd my-website
```

the directory should look something like this:


```
|- src
  |- index.html
|- serverless.yml
|- .env      # your AWS api keys

```

```
# .env
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

The `src` directory could either be a simple directory of html/css/js assets files, or a full fledged React app.

### 4. Configure

```yml
# serverless.yml

org: serverlessinc # replace with your own org
app: myApp
component: website
name: myWebsite

inputs:
  src:                        # The folder to be uploaded containing your website code
  region: us-east-1           # (optional) The AWS region to deploy your website into
  bucketName: myBucket        # (optional) The Bucket name where `src` files/folder will be upload. 
                              #            If not provided, it will create random bucket name and upload `src` files
  env:                        # (optional) Environment variables to include in a 'env.js' file with your uploaded code.
    API_URL: https://api.com

  domain: www.example.com     # (optional) You can specify a custom domain name for your website.
                              #            You must have a public hosted zone available for this domain in AWS Route53.
                              #            This is done automatically for you if you've purchased the domain via AWS Route53.
```

You could also specify a build step that run before your source code is uploaded:


```
# serverless.yml

org: serverlessinc
app: myApp
component: website
name: myWebsite

inputs:
  src:
    src: ./src                # The folder containing your built source artifact
    hook: npm run build       # (optional) A hook to build/test/do anything to your code before uploading
    dist: ./dist              # (optional) The dist directory to be uploaded in case you specified a hook
```
### 5. Deploy

```
$ serverless deploy

serverless ⚡ framework
Action: "deploy" - Stage: "dev" - App: "myApp" - Instance: "myWebsite"

bucket:    website-ru236lh
bucketUrl: http://website-ra236lh.s3-website-us-east-1.amazonaws.com
url:       https://d22egpgsqgt74y.cloudfront.net
domain:    https://serverless.com

More instance info at https://dashboard.serverless.com/tenants/serverlessinc/applications/myApp/component/myWebsite/stage/dev/overview

3s › myWebsite › Success
```

### 6. Info

```
$ serverless info
```

### 7. Remove

```
$ serverless remove
```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
