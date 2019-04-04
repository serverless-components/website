
&nbsp;

Deploy a static website to AWS S3 in seconds using [Serverless Components](https://github.com/serverless/components). Just provide your frontend code (powered by the [AwsS3 component](https://github.com/serverless-components/AwsS3)).

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)

&nbsp;

### 1. Install

```console
$ npm install -g @serverless/components
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

```

The `code` directory could either be a simple directory of html/css/js assets files, or a full fledged React app.

### 3. Configure

```yml
# serverless.yml

name: my-website
stage: dev

myWebsite:
  component: @serverless/website
  inputs:
    # path to the directory the contains your frontend code
    path: ./code
    
    # you can provide an env file path to be generated for use by your frontend code
    envFile: ./frontend/src/env.js

    # the contents of this env file
    env:
      API_URL: https://api.com

    # if you're using React...
    # this is the the path to the dist directory
    assets: ./dist
    # and this is the build command that would build the code from the path dir to the assets dir
    buildCmd: npm run build
```

### 4. Deploy

```console
$ components
```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
