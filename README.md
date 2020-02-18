# Serverless Website

&nbsp;

Deploy a static website to AWS S3 in seconds using [Serverless Components](https://github.com/serverless/components).

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)
5. [Info](#5-info)
6. [Remove](#6-remove)

&nbsp;

### 1. Install

```console
$ npm install -g serverless@components
```

### 2. Create

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

### 3. Configure

```yml
# serverless.yml

org: serverlessinc
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
### 4. Deploy

```
$ serverless deploy
```

### 5. Info

```
$ serverless info
```

### 6. Remove

```
$ serverless remove
```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
