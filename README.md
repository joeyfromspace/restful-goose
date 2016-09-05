# RESTful Goose

Yet another RESTful microservice generator for Mongoose with an emphasis on flexibility. This API uses the [JSON API spec](http://jsonapi.org/) and supports optional child models.

Version: 2.0.0-beta1

# Major Update - Version 2.0.0
2.0.0 is a complete rewrite of RESTful Goose. It takes what I learned from building 1.x and does everything in a much more efficient and powerful way.

However, 2.x is COMPLETELY incompatible with 1.x so please take care when updating your application.

## Installation
```
npm install restful-goose
```

## Use
Version 2 of RESTful Goose is much easier to use. The constructor only accepts one argument: a Mongoose Connection.

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