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
    env: # Environment variables to include in a 'env.js' file with your uploaded code.
      API_URL: https://api.com
```

### 4. Deploy

```console
$ serverless

```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
