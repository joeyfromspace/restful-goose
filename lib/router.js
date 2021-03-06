var express = require('express');
var async = require('async');
var moment = require('moment');
var _ = require('lodash');

var helpers = require('./helpers');
var errorHandler = require('./error-handler');

module.exports = (function() {
  'use strict';
  var router = express.Router();
  var paths = ['/:resource_type/:parent_item_id/relationships/:relationship_type/:item_id', '/:resource_type/:parent_item_id/relationships/:relationship_type', '/:resource_type/:item_id', '/:resource_type?'];  

  router.use(paths, function(req, res) {
    res.rg.log.debug('initialize request');
    var startTime = Date.now();
    var method = req.method;
    var modelName = helpers.toModelName(req.params.resource_type);
    var currentMap = res.rg.routeMap[modelName];
    var eventQueue = _.omitBy(currentMap, function(v) {
      return v.methods.indexOf(method) === -1;
    });
    res.rg.log.debug('Received ' + method + ' request at ' + req.originalUrl);
    res.rg.log.debug('Event Queue: ' + _.keys(eventQueue).join(', '));
    _.set(res, 'rg.currentMap', currentMap);

    async.eachOfSeries(eventQueue, function(fn, key, next) {
      res.rg.log.debug('Route ' + req.originalUrl + ' event: ' + key);

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

      res.rg.log.debug('Request completed in ' + processTime + ' milliseconds');
    });
  });

  return router;
}());
