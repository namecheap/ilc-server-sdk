# App development SDK for ILC
[![NPM package](https://badgen.net/npm/v/ilc-sdk?color=red&icon=npm&label=)](https://www.npmjs.com/package/ilc-sdk)
[![NPM downloads](https://badgen.net/npm/dt/ilc-sdk)](https://www.npmjs.com/package/ilc-sdk)

SDK intended for use inside Micro Frontends to conveniently communicate with Isomorphic Layout Composer.

## Installation

```bash
$ npm i ilc-sdk
```

## Node.js and app bundles

This package features 2 bundles that are intended to be used in Node.js app that runs SSR bundle of your app and
the application itself.

### Node.js bundle

It works only in Node.js and is designed to parse requests from ILC and form responses. It also provides adapter for application 
bundle to work in Node.js environment.

- How to use: 
    - For apps: `const IlcSdk = require('ilc-sdk').default;` ([Documentation](https://namecheap.github.io/ilc-sdk/classes/_server_ilcsdk_.ilcsdk.html))
    - For App Wrappers: `const { IlcAppWrapperSdk } = require('ilc-sdk');` ([Documentation](https://namecheap.github.io/ilc-sdk/classes/_server_ilcappwrappersdk_.ilcappwrappersdk.html))

**Vue.js example:**
```javascript
const fs = require('fs');
const express = require('express');
const server = express();

const {createBundleRenderer} = require('vue-server-renderer');
const bundle = require('./dist/vue-ssr-server-bundle.json');
const clientManifest = require('./dist/vue-ssr-client-manifest.json');
const appAssets = {
    spaBundle: clientManifest.all.find(v => v.endsWith('.js')),
    cssBundle: clientManifest.all.find(v => v.endsWith('.css'))
};

const IlcSdk = require('ilc-sdk').default;
const ilcSdk = new IlcSdk({ publicPath: clientManifest.publicPath });

const renderer = createBundleRenderer(bundle, {
    template: fs.readFileSync('./index.template.html', 'utf-8'),
    clientManifest: clientManifest,
    runInNewContext: false,
    inject: false
});

server.get('/_ilc/assets-discovery', (req, res) => ilcSdk.assetsDiscoveryHandler(req, res, appAssets));

server.get('*', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    
    const ilcData = ilcSdk.processRequest(req);

    const context = {
        ilcData,
        url: ilcData.getCurrentReqUrl(),
    };

    renderer.renderToString(context, (err, html) => {
        if (err) {
            // ...
            return;
        } 
        
        ilcSdk.processResponse(ilcData, res, {
            pageTitle: context.meta.inject().title.text(),
            pageMetaTags: context.meta.inject().meta.text(),
            appAssets,
        });
        res.send(html);
    });

});
```

### Application bundle

Provides SDK that should be used within your application bundle. It works well with server and client side rendering.

- How to use: `import IlcAppSdk from 'ilc-sdk/app';`
- Documentation [is available via this link](https://namecheap.github.io/ilc-sdk/classes/_app_index_.ilcappsdk.html).


## JS docs

See https://namecheap.github.io/ilc-sdk/


## Low level ILC <-> Micro Frontend interface

This is the description of the server side ILC <-> Micro Frontend interface which is implemented by this library in a form
of SDK.

### Input interface ILC -> Micro Frontend
With every request for SSR content from the app ILC sends the following meta-information:
1. Query parameter `routerProps`

   Contains base64 encoded JSON object with the following keys:
   * `basePath` - Base path that is relative to the matched route.
   
       So for `reqUrl = /a/b/c?d=1` & matched route `/a/*` base path will be `/a/`.
       While for `reqUrl = /a/b/c?d=1` & matched route `/a/b/c` base path will be `/a/b/c`.
   * `reqUrl` - Request URL string. This contains only the URL that is present in the actual HTTP request. It **DOES NOT** contain information about locale.
       
       `reqUrl` = `/status?name=ryan` if the request is:
       ```
       GET /status?name=ryan HTTP/1.1\r\n
       Accept: text/plain\r\n
       \r\n
       ```
   * _(legacy)_ `fragmentName` - string with name of the fragment
1. Query parameter `appProps`
  
   Sent only if app has some _Props_ defined at the app or route slot level.
   Contains base64 encoded JSON object with defined _Props_.
  
1. Header `x-request-uri`. Request URL string. This contains only the URL that is present in the actual HTTP request. It **may contain** information about locale.

1. Optional header `x-request-intl`. Present only if ILC runs with Intl feature enabled. Format is described [here](./src/server/IlcProtocol.ts).

Both query params mentioned here can be decoded in the following manner:
```javascript
JSON.parse(Buffer.from(req.query.routerProps, 'base64').toString('utf-8'))
```

### Response interface Micro Frontend -> ILC

App possible response headers:

* `Link` - Check [reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link).
* `x-head-title` - _(only primary app)_ Page title encoded with base64. Will be injected onto `<head>` tag.
Ex: `Buffer.from('<title>Page title</title>', 'utf-8').toString('base64')`
* `x-head-meta` - _(only primary app)_ Page [meta tags](https://www.w3schools.com/tags/tag_meta.asp) encoded with base64.
Ex: `Buffer.from('<meta name="description" content="Free Web tutorials"><meta name="keywords" content="HTML,CSS,XML,JavaScript">', 'utf-8').toString('base64')`

HTTP status code from the primary app will be used to define HTTP status code of the requested page.

#### App Wrappers

If Micro Frontend has been registered as "App Wrapper" it can respond in a special format to forward SSR request to the target 
application. To do so app need to return `210` HTTP status code with following headers available:

* `x-props-override` - Props which will override values returned by getCurrentPathProps() for target app. 
Ex: `Buffer.from(JSON.stringify(propsOverride)).toString('base64'))`

See [wrapper application](https://github.com/namecheap/ilc-demo-apps/tree/master/apps/wrapper) in ILC Demo apps for 
sample use of the functionality.