var express = require('express');
var async = require('async');
var debug = require('debug')('restful-goose:router');
var moment = require('moment');
var _ = require('lodash');

var helpers = require('./helpers');
var errorHandler = require('./error-handler');

module.exports = (function() {
  'use strict';
  var router = express.Router();
  var paths = ['/:parent_resource_type/:parent_item_id/relationships/:resource_type/:item_id', '/:parent_resource_type/:parent_item_id/relationships/:resource_type', '/:resource_type/:item_id', '/:resource_type'];
  debug('Router instantiated');
  
  router.use(paths, function(req, res) {
    var startTime = Date.now();
    var method = req.method;
    var modelName = helpers.toModelName(req.params.resource_type);
    var eventQueue = _.omitBy(res.rg.routeMap[modelName], function(v) {
      return v.methods.indexOf(method) === -1;
    });
    debug('Received request at ' + req.originalUrl);
    debug('Event Queue: ' + _.keys(eventQueue).join(', '));
    
    async.eachOfSeries(eventQueue, function(fn, key, next) {
      debug('Route ' + req.originalUrl + ' event: ' + key);
      
      if (res.headersSent) {
        return next();
      }
      
      fn(req, res, next);
    }, function() {
      var processTime = moment().diff(startTime, 'milliseconds');
      
      /* Handle any errors that popped up along the way */
      if (res.errors && res.errors.length) {
        errorHandler(req, res); 
      }
      
      debug('Request completed in ' + processTime + ' milliseconds');
    });
  });

  return router;
}());