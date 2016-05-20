var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var apiRouter = require('./router');
var onError = require('./on-error');
var morgan = require('morgan');

var mountRouter = function(app, router, options) {
  /* Mount the router and return the app if no authenticators are provided */
  if (!options.authenticators) {
    app.use(router);
    return app;
  }

  /* Use the global authenticator if one is provided */
  if (options.authenticators.hasOwnProperty('all')) {
    return app.use([options.authenticators.all, router]);
  }

  /* Iterate through each HTTP method, assigning the authenticator middleware to the appropriate requests */
  _.forEach(options.authenticators, function(middleware, method) {
    app[method] = [middleware, router];
  });

  return app;
};

/**
 * @constructor
 *
 * @param Model {Object} - Mongoose model to query on each route
 *
 * @param [options] {Object} - The options object
 * @param [options.onError] {function} - A middleware function for error-handling. Default error-handling used if none is provided.
 * @param [options.authenticators] {object} - An object containing authentication middleware for get, post, put, delete requests. This is intended to allow you the flexibility to deny access to certain operations and certain users based on your own specific criteria.
 */
var APIFactory = function(Model, options) {
  if (!options) {
    options = {};
  }

  var app = express();
  app.use(morgan('dev'));
  /* Generate API routes using the api router factory */
  var router = apiRouter(Model, options);

  /* Mount basic middleware in case there is no parent express app or the parent doesn't use the appropriate body parser middleware */
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  /* Mount error-handling middleware to res object */
  app.use(function(req, res, next) {
    res.__onError = options.onError || onError;
    next();
  });

  /* Mount router on the app and return the modified app */
  return mountRouter(app, router, options);
};

/* Expose API factory */
module.exports = APIFactory;