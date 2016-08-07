var express = require('express');
var RouteMap = require('./route-map');
var _ = require('lodash');
var router = require('./router');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var debug = require('debug')('restful-goose:app');

module.exports = (function() {
  'use strict';

  /**
   * Constructs a REST API from the models included in a Mongoose instance.
   * @param {mongoose.Connection} mongoose - The Mongoose connection to use for all operations
   * @returns {express.app} An Express App object that is ready to be mounted in your parent application
   * @constructor
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
      debug('res.rg.mongoose: ' + Boolean(res.rg.mongoose));
      debug('res.rg.routeMap: ' + Boolean(res.rg.routeMap));
      next();
    });
    
    api.defineRoute = function(modelName, _routeMap) {
      debug('api.defineRoute invoked for ' + modelName);
      _.set(routeMap, modelName, _routeMap);
    };

    debug('Mounting router to api object...');
    api.use(router);

    return api;
  };

  /**
   * Exposing the RouteMap constructor for extending a model's routes 
   * @method
   */
  RGFactory.RouteMap = RouteMap;
    
  return RGFactory;
}());