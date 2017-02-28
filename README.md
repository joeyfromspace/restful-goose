# RESTful Goose

Yet another RESTful microservice generator for Mongoose with an emphasis on flexibility. This API uses the [JSON API spec](http://jsonapi.org/) and supports optional child models.

Version: 2.2.21
https://travis-ci.org/joeyfromspace/restful-goose.svg?branch=master

## What's New
### 2.2.21
- The serializer was crashing when `undefined` was being passed where an array was expected. This has been fixed.
- Fixed an issue with link objects being serialized inside the data member for relationships.
- Minor refactoring to code to improve readability, efficiency, and documentation
- Began work on some future features (such as selective model APIs, smart link building, prefix support, etc.)

### 2.2
- Added advanced filtering inspired by [json-api](https://www.npmjs.com/package/json-api#filtering) npm package. Just do ?filter[simple][updated-at][$lte]=<timestamp>!
- Fixed sorting

## Installation
```
npm install restful-goose
```

## Use
Version 2 of RESTful Goose is much easier to use. The constructor only requires one argument: a Mongoose Connection.

```
var restfulGoose = require('restful-goose');
var mongoose = require('mongoose');

mongoose.connect('localhost');
restfulGoose(mongoose).listen(3000);
```

Your API will be listening for connections on port 3000.

Alternatively, and probably the more common use, would be to mount RESTful Goose under your existing Express app so you can take advantage of authentication middlewares and the like:

 ```
 var express = require('express');
 var restfulGoose = require('restfulGoose');
 var mongoose = require('mongoose');

 var app = express();
 var myMiddleware = [passport.authenticate('bearer'), validateUser];

 app.use('/api', myMiddleware, restfulGoose(mongoose));

 app.listen(3000);
 ```

## Customization
The best part about RESTful Goose 2 is the much greater flexibility you have to customize how the app handles individual routes.

Every route goes through an event loop, calling a series of functions that you can hook at nearly every stage of handling a request.

The base restfulGoose export exposes the RouteMap object, which you can copy via the object's `extend()` method:

```
/* post-route.js */
var RouteMap = require('restful-goose').RouteMap;

module.exports = RouteMap.extend({
    beforeModel: function(req, res, next) {
        // Modify the query to only return users' own posts
        req.query.user = req.user.id;
    }
});
```

Then bind your custom map to your restfulGoose instance using the instance's `defineRoute()` method:

```
/* app.js */
var restfulGoose = require('restful-goose');
var postRoute = require('./post-route');
// ...

var api = restfulGoose(mongoose);

/* defineRoute(modelName, routeMapObject) */
api.defineRoute('Post', postRoute);
```

## BETA: Selective models
It is now possible to pass an options object with a `models` key that contains an array of mongoose Model constructors (so not Document instances, but the actual Model class you invoke with the `mongoose.model()` method). 
Use this if you only want to make some models available via the API. *WARNING: this is a beta feature and isn't yet fully implemented*. As of now, only top level endpoints are disabled. Relationship objects still populate
even if a model isn't included in the API.

## TODO
* The ability to specify a prefix for constructed link objects (and perhaps smarter link construction)