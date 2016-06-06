# RESTful Goose

Yet another RESTful microservice generator for Mongoose with an emphasis on flexibility. This API uses the [JSON API spec](http://jsonapi.org/) and supports optional child models.

## Installation
```
npm install restful-goose
```

## Use
```
var express = require('express');
var mongoose = require('mongoose');
var restfulGoose = require('restful-goose');

var app = express();

var mySchema = new mongoose.Schema({});
mongoose.model('Article', mySchema);

var api = restfulGoose(mongoose.model('Article'), { subModels: ['Comment'] });

app.use('/api', api);
```

This will mount the model under /api/articles and comments under /api/articles/comments.

## Supported Methods
As per the JSON API spec, the following methods are supported: GET, POST, PATCH, DELETE. Use PATCH to update objects instead of PUT by including only those parameters you would like to update.

## Options

### Authenticators
Optional middleware can be set on a per-method basis to allow or deny access to a route. This is helpful if you want certain users to be able to GET resources but not DELETE them. You can use the "all" key to apply an authenticator to every method on a route. You can also mount any middleware you want in front of the API sub-app as per a normal Express route.

Example:
```
var options = {
    authenticators: {
        delete: function(req, res, next) {
            if (req.user) {
                return next();
            }
            
            res.status(403).json({ errors: [{ title: 'Unauthorized', detail: 'You do not have access to this resource', status: 403 }]);
        }
    }
};

var api = restfulGoose(Article, options); 

app.use('/api', api);
```

DELETE requests will be denied unless req.user is truthy.
 
### Custom Error Handling
RESTful Goose comes with JSON API compliant error-handling out of the box. However, if you want to replace it with your own error-handling middleware, you can supply it in the `onError` option. The function is passed the request and response object as well as the error object that triggered the error.

### SubModels
Nothing is populated by default and any associated objects are inaccessible. If you have a model that lives under another (for instance, comments that live in their own collection but are associated with an article object), you can supply an array of model names in the options' `subModels` property. These will automatically be mounted under /parent-model/:parent-id/sub-model/:sub-id.

### Custom Middleware
Set custom middleware for each route by passing an object with the appropriate method key at the `middlewares` object. This function will be called after any authentication middleware. Handy for file uploads and other custom functions you want to inject before a route.

## TODO
* Populate links in responses
* Make more use of related and relationships objects in responses