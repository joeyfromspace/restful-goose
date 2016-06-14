var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var apiRouter = require('./router');
var onError = require('./on-error');
var morgan = require('morgan');
var pluralize = require('pluralize');
var mongoose = require('mongoose');
var helpers = require('./helpers');

/**
 * @constructor
 *
 * @param Models {Object|Object[]} - Mongoose model to query on each route
 *
 * @param [options] {Object} - Options that apply to the API sub-app as a whole
 * @param [options.onError] {function} - A middleware function for error-handling. Default error-handling used if none is provided.
 * @param [options.middleware] {object} - An object where the containing middleware to run routes through after they've been run
 * @param [options.middleware.get] {function[]} - Middleware to apply to all GET requests
 * @param [options.middleware.post] {function[]} - Middleware to apply to all POST requests
 * @param [options.middleware.patch] {function[]} - Middleware to apply to all PATCH requests
 * @param [options.middleware.delete] {function[]} - Middleware to apply to all DELETE requests
 * @param [options.middleware.all] {function[]} - Middleware to apply to all requests
 * @param [options.mountPath=/] {string} - The full-path where API resources will be made available (e.g. https://www.my-api.com/v1/)
 *
 * @param [taxonomy] {Object} - An option that applies to only a specific route
 * @param [taxonomy.onError] {function} - A middleware function for error-handling. Default error-handling used if none is provided.
 * @param [taxonomy.authenticators] {object} - An object containing authentication middleware for get, post, put, delete requests. This is intended to allow you the flexibility to deny access to certain operations and certain users based on your own specific criteria.
 * @param [taxonomy.middleware] {object} - An object containing middleware to run routes through after they've been run
 * @param [taxonomy.mountPath=/kebab-case-plural-model-name] {string} - The full-path where API resources will be made available (e.g. https://www.my-api.com/v1/). Will be concatenated with the app mountPath in options.
 * @param [taxonomy.subModels] {string[]} - One or more sub-models that should be accessible under the /relationships link
 */
var APIFactory = function(Models, options, taxonomy) {
  var app = express();
  var baseURL;
  var replaceSlashes = function(url) {
    if (url.substr(0, 4) === 'http') {
      return  url.substr(0, url.indexOf('//') + 1) + (url.substr(url.indexOf('//')).replace('//', '/'));
    } else {
      return url.replace('//', '/');
    }
  }
  app.use(morgan('dev'));

  /* Mount basic middleware in case there is no parent express app or the parent doesn't use the appropriate body parser middleware */
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

  /* Initialize options and apply default values */
  if (!options) {
    options = {};
  }

  if (!taxonomy) {
    taxonomy = {};
  }

  _.defaults(options, {
    mountPath: '/',
    onError: onError,
    middleware: {}
  });

  baseURL = options.mountPath;

  /* Apply middleware to router app */
  _.forEach(options.middleware, function(middleware, method) {
    if (method === all) {
      app.use(middleware);
    }

    app[method]('*', middleware);
  });

  /* Iterate over Models array and initialize their routers */
  _.forEach(Models, function(Model) {
    
    var modelName = Model.modelName;
    var opts = taxonomy[modelName] || {};
    var router;
    var defaults = _.merge({
      authenticators: {},
      middleware: {},
      subModels: [],
      onError: onError
    }, options);
    
    defaults.mountPath = '/' + helpers.toResourceType(modelName);

    _.defaults(opts, defaults);
    
    /* Generate API routes using the api router factory */
    router = express.Router();

    router.use(function(req, res, next) {
      req.baseURL = replaceSlashes(baseURL + opts.mountPath);
      res.__onError = opts.onError;
      next();
    });

    _.forEach(opts.authenticators, function(authenticator, method) {
      if (method === 'all') {
        router.use(authenticator);
      }

      router[method]('*', authenticator);
    });

    _.forEach(opts.middleware, function(middleware, method) {
      if (method === 'all') {
        router.use(middleware);
      }

      router[method]('*', middleware);
    });
    
    router.use(apiRouter(Model));

    _.forEach(opts.subModels, function(subModelName) {
      var SubModel = mongoose.model(subModelName);
      var subResource = _.chain(Model.schema.paths).find(function(p) {
        return p.options.ref === SubModel.modelName;
      }).get('path').kebabCase().value();
      
      if (!subResource) {
        subResource = helpers.toResourceType(subModelName);
      }
      
      var subRouter = apiRouter(SubModel);
      var getParentMiddleware = function(req, res, next) {
        if (!req.params.parent) {
          return next();
        }

        Model.findById(req.params.parent, function(err, parentDoc) {
          req.parent = parentDoc;
          req.parentPath = _.find(SubModel.schema.paths, function(p) {
            return p.options.ref === Model.modelName;
          }).path;
          req.baseURL = replaceSlashes(req.baseURL + '/' + parentDoc.id + '/relationships/' + subResource);
          next();
        });
      };
      router.use('/:parent/relationships/' + subResource, [getParentMiddleware, subRouter]);
    });

    /* Mount router on the app and return the modified app */
    app.use(opts.mountPath, router);

    /* Mount error-handling middleware to res object */
    app.use(function(req, res, next) {
      res.__onError = options.onError || onError;
      next();
    });
  });

  return app;
};

/* Expose API factory */
module.exports = APIFactory;