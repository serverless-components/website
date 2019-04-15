# Serverless Website

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
|- .env      # your development AWS api keys
|- .env.prod # your production AWS api keys

```

the `.env` files are not required if you have the aws keys set globally and you want to use a single stage, but they should look like this.

```
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
    # path to the directory that contains your frontend code
    # if you're using a framework like React, that would be the root of your frontend project, otherwise it'd be where index.html lives.
    # default is the current working directory.
    code: ./code
    
    # if your website needs to be built (e.g. using React)...
    build:
    
      # the path to the build directory. default is ./build
      dir: ./dist
      
      # the build command
      command: npm run build # this is the default anyway!
      
      # you can provide an env file path (relative to the code path above) to be generated for use by your frontend code. By default it's './src/env.js'
      envFile: ./frontend/src/env.js
      
      # the contents of this env file
      env:
        API_URL: https://api.com
```

### 4. Deploy

```console
Website (master)$ ⚡️components

  Website › outputs:
  url:  'http://serverless-0c4351.s3-website-us-east-1.amazonaws.com'


  6s › dev › Website › done

Website (master)$

```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
