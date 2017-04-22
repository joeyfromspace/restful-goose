var express = require('express');
var RouteMap = require('./route-map');
var _ = require('lodash');
var router = require('./router');
var bodyParser = require('body-parser');
var winston = require('winston');
var errorDefs = require('./errors');

/**
 * @module restful-goose/app
 */
module.exports = (function() {
  'use strict';

  /**
   * @typedef {Object} RGOptions
   * @property {string|boolean} prefix - Provide a path prefix to preface all constructed links with (ex: /api). If set to `true`, will construct links automatically. Set to `false` to only build partial links.
   * @property {mongoose.Model[]} models - Models to enable on the API. If none are  provided, all models registered to the passed in mongoose connection will be used (the default option). This will be overriden if `RestfulGoose.defineRoute()` is called on a model after initialization.
   * @property {winston.Logger} log - Pass in your log service to use for logging. Accepts any thing object that has methods for info, log, error, debug, etc. Defaults to winston's global logger instance.
   * @property {boolean} suppress4xxErrors - Prevents 400 level errors from being printed in the error log (they will be printed to info instead). Defaults to true.
   */

  /**
   * Constructs a REST API from the models included in a Mongoose instance.
   * @public
   * @function RGFactory
   * @param {mongoose.Connection} mongoose - The Mongoose connection to use for all operations
   * @param {RGOptions} options - Options for the app instance
   * @returns {RestfulGooseApp} - A new Express App object that is ready to be mounted in your parent application
   */
  var RGFactory = function(mongoose, options) {
    /**
     * @var RestfulGooseApp
     */
    var api = express();
    var routeMap = {};
    var log;
    var defaultLogger = winston.loggers.add('rg', {
      console: {
        level: 'debug'
      }
    });
    var defaultOpts = {
      prefix: false,
      models: mongoose.models,
      log: defaultLogger,
      suppress4xxErrors: true
    };

    if (!options) {
      options = {};
    }

    _.defaults(options, defaultOpts);
    log = options.log;

    log.debug('%s models registered to mongoose instance.', _.size(options.models));
    _.forEach(options.models, function(model) {
      log.debug('Generating default route map for ' + model.modelName);
      _.set(routeMap, model.modelName, RouteMap.extend({}));
    });

    //api.use(morgan('dev'));
    api.use(bodyParser.urlencoded({ extended: false }));
    api.use(bodyParser.json());
    api.use(bodyParser.json({ type: 'application/vnd.api+json'}));

    api.all('*', function (req, res, next) {
      // If database is disconnected, abort request
      if (mongoose.readyState !== 1) {
        res.status(500).send();
        throw new Error('DB connection not ready');
      }

      log.debug('Setting rg response variables...');
      _.set(res, 'rg.mongoose', mongoose);
      _.set(res, 'rg.routeMap', routeMap);
      _.set(res, 'rg.ERR', errorDefs);
      _.set(res, 'rg.prefix', options.prefix);
      _.set(res, 'rg.log', options.log);
      _.set(res, 'rg.suppress4xxErrors', options.suppress4xxErrors);
      log.debug('res.rg.mongoose: ' + Boolean(res.rg.mongoose));
      log.debug('res.rg.routeMap: ' + Boolean(res.rg.routeMap));
      next();
    });

    /**
     * @method defineRoute
     * @access public
     * @memberof RestfulGooseApp
     * @param {string} modelName - Name of the model to bind the route to
     * @param {RouteMap} modelRouteMap - A route map constructed with the extend() method
     * @returns {void}
     */
    api.defineRoute = function(modelName, modelRouteMap) {
      log.debug('api.defineRoute invoked for ' + modelName);
      _.set(routeMap, modelName, modelRouteMap);
    };

    log.debug('Mounting router to api object...');
    api.use(router);

    return api;
  };

  /**
   * @access public
   * @type {RouteMap}
   * @description Exposing the RouteMap object to the application
   */
  RGFactory.RouteMap = RouteMap;

  return RGFactory;
}());
