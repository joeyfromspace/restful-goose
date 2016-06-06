var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var apiRouter = require('./router');
var onError = require('./on-error');
var morgan = require('morgan');
var pluralize = require('pluralize');
var decamelize = require('decamelize');
var mongoose = require('mongoose');

/* Empty middleware to serve as a filler when there is no authenticators or middleware */
var _passThrough = function(req, res, next) {
  next();
};

var mountRouter = function(router, Model, options) {
  var subApp = express();
  var methods = ['get', 'post', 'patch', 'delete'];
  var subModels = options.subModels || [];
  var subrouters = _.map(subModels, function(sub) {
    var SubModel = typeof sub === 'string' ? mongoose.model(sub) : sub;
    return apiRouter(SubModel, Model);
  });
  
  if (!options) {
    options = {};
  }
  
  _.defaults(options, {
    middlewares: {},
    authenticators: {},
    subModels: []
  });

  _.forEach(methods, function(m) {
    var authenticator = options.authenticators[m] || options.authenticators.all || _passThrough; 
    var middlewares = options.middlewares[m] || options.middlewares.all || _passThrough;
    
    subApp[m]('*', authenticator, middlewares, router);
  });
  
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