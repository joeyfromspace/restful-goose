var express = require('express');
var RouteMap = require('./route-map');
var _ = require('lodash');
var router = require('./router');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var debug = require('debug')('restful-goose:app');
var errorDefs = require('./errors');

/**
 * @namespace RestfulGoose
 * @augments express.App
 * @description An express app that functions as a JSONAPI for Mongoose models 
 */
module.exports = (function() {
  'use strict';

  /**
   * Constructs a REST API from the models included in a Mongoose instance.
   * @public
   * @function RGFactory
   * @param {mongoose.Connection} mongoose - The Mongoose connection to use for all operations
   * @returns {RestfulGoose} A new Express App object that is ready to be mounted in your parent application
   */
  var RGFactory = function(mongoose) {
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
     * @public
     * @memberof RestfulGoose
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
   * @public
   * @type {RouteMap}
   * @memberof RestfulGoose
   * @description Exposing the RouteMap object to the application
   */
  RGFactory.RouteMap = RouteMap;
    
  return RGFactory;
}());