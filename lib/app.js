var express = require('express');
var RouteMap = require('./route-map');
var _ = require('lodash');
var router = require('./router');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var debug = require('debug')('restful-goose:app');
var errorDefs = require('./errors');


module.exports = (function() {
  'use strict';

  /**
   * @typedef {Object} RGOptions
   * @property {string | boolean} prefix - Provide a path prefix to preface all constructed links with (ex: /api). If set to `true`, will construct links automatically. Set to `false` to only build partial links.
   * @property {mongoose.Model[]} models - Models to enable on the API. If none is provided, all models registered to the passed in mongoose connection will be used (the default option).
   * 
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

    debug(_.size(mongoose.models) + ' models registered to mongoose instance.');
    _.forEach(mongoose.models, function(model) {
      debug('Generating default route map for ' + model.modelName);
      _.set(routeMap, model.modelName, RouteMap.extend({}));
    });

    api.use(morgan('dev'));
    api.use(bodyParser.urlencoded({ extended: false }));
    api.use(bodyParser.json());
    api.use(bodyParser.json({ type: 'application/vnd.api+json'}));

    api.all('*', function(req, res, next) {
      debug('Setting rg response variables...');
      _.set(res, 'rg.mongoose', mongoose);
      _.set(res, 'rg.routeMap', routeMap);
      _.set(res, 'rg.ERR', errorDefs);
      debug('res.rg.mongoose: ' + Boolean(res.rg.mongoose));
      debug('res.rg.routeMap: ' + Boolean(res.rg.routeMap));
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
      debug('api.defineRoute invoked for ' + modelName);
      _.set(routeMap, modelName, modelRouteMap);
    };

    debug('Mounting router to api object...');
    api.use(router);

    return api;
  };

  /**
   * @access public
   * @type {RouteMap}
   * @description Exposing the RouteMap object to the application
   */
  RGFactory.RouteMap = RouteMap;

  /**
   * @exports
   */
  return RGFactory;
}());
