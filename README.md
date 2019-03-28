# Website
A serverless component that provisions a static website.

## Usage

### Declarative

```yml

name: my-website
stage: dev

Website@0.1.1::my-website:
  name: my-website
  
  # the root of your website project
  path: ./
  
  # path to the assets dir to be uploaded to S3
  assets: ./dist
  
  # environment data to include in your envFile below
  env:
    foo: bar
    
  # path to the env file to be included in your build
  envFile: ./src/env.js
  
  buildCmd: npm run build
```

### Programatic

```js
npm i --save @serverless/website
```

```js

const website = await this.load('@serverless/website')

const inputs = {
  name: 'my-website',
  path: process.cwd(),
  assets: process.cwd(),
  envFile: path.join(process.cwd(), 'src', 'env.js'),
  env: {},
  buildCmd: null,
  region: 'us-east-1'
}

await website(inputs)

```
