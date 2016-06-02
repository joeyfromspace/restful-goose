var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var apiRouter = require('./router');
var onError = require('./on-error');
var morgan = require('morgan');
var pluralize = require('pluralize');
var decamelize = require('decamelize');
var mongoose = require('mongoose');

var mountRouter = function(router, Model, options) {
  var subApp = express();
  var methods = ['get', 'post', 'patch', 'delete'];
  var subModels = options.subModels || [];
  var subrouters = _.map(subModels, function(sub) {
    var SubModel = typeof sub === 'string' ? mongoose.model(sub) : sub;
    return apiRouter(SubModel, Model);
  });

  /* Mount the router and return the app if no authenticators are provided */
  if (!options.authenticators) {
    subApp.use(router);
  }

  /* Use the global authenticator if one is provided */
  else if (options.authenticators.hasOwnProperty('all')) {
    subApp.use([options.authenticators.all, router]);
  }

  /* Iterate through each HTTP method, assigning the authenticator middleware to the appropriate requests */
  else {
    _.forEach(methods, function(method) {
      var route = options.authenticators.hasOwnProperty(method) ? [options.authenticators[method], router] : [router];
      subApp[method]('*', route);
    });
  }

  _.forEach(subrouters, function(sub) {
    subApp.use(sub);
  });

  return subApp;
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
  var baseURL = '/' + pluralize(decamelize(Model.modelName,'-'), 2).toLowerCase();

  if (!options) {
    options = {};
  }

  var app = express();
  app.use(morgan('dev'));
  /* Generate API routes using the api router factory */
  var router = apiRouter(Model);

  /* Mount basic middleware in case there is no parent express app or the parent doesn't use the appropriate body parser middleware */
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(bodyParser.json({ type: 'application/vnd.api+json' }));


  /* Mount error-handling middleware to res object */
  app.use(function(req, res, next) {
    res.__onError = options.onError || onError;
    next();
  });

  /* Mount router on the app and return the modified app */
  app.use(baseURL, mountRouter(router, Model, options));

  return app;
};

/* Expose API factory */
module.exports = APIFactory;