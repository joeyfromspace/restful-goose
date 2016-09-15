var helpers = require('./helpers');
var ERR = require('./error-handler');
var async = require('async');
var _ = require('lodash');
var debug = require('debug')('restful-goose:RouteMap');
var mongoose = require('mongoose');

/**
 * @namespace RouteMap
 * @description Interfaces with a Mongoose model to handle API requests for a single object or a collection of objects
 */
var RouteMap = (function() {
  'use strict';
  var METHODS = {
    DELETE: 'DELETE',
    PATCH: 'PATCH',
    POST: 'POST',
    GET: 'GET'
  };

  var RouteMap = function(){};
  RouteMap.prototype = Object.create(null);
  
  /**
   * Returns a fresh copy of RouteMap with your provided hash of functions. Use this to replace the default event handlers with your own.
   * @memberof RouteMap
   * @method extend   
   * @param {object} properties - A hash of functions with handlers for various events, called during invocation
   * @returns {RouteMap} routeMap - New route map
   */
  RouteMap.prototype.extend = function(properties) {
    var privateKeys = _.chain(RouteMap.prototype).filter(function(v) {
      return v.isPrivate;
    }).keys().value();
    debug(privateKeys);
    var filteredProperties = _.chain(properties).omit(privateKeys).mapValues(function(v, k) {
      v.methods = RouteMap.prototype[k].methods;
      return v;
    }).value();
    debug(filteredProperties);
    return _.create(RouteMap.prototype, filteredProperties);
  };
  RouteMap.prototype.extend.methods = [];
  RouteMap.prototype.extend.isPrivate = true;

  /**
   * Function responsible for binding internal variables to the req/res object for use in future events
   * @method
   * @private
   * @param {express.Request} req
   * @param {express.Response} res
   * @param {function} next - Callback function for when routing is complete
   */
  RouteMap.prototype.init = function(req, res, next) {
    Object.assign(res.rg, {
      Model: res.rg.mongoose.model(helpers.toModelName(req.params.resource_type)),
      search: helpers.querySearch,
      serialize: helpers.serialize,
      deserialize: helpers.deserialize,
      sendError: ERR
    });    
    res.errors = [];

    if (_.keys(req.body).length) {
      req.data = helpers.deserialize(req.body);
    }

    next();
  };
  RouteMap.prototype.init.methods = [METHODS.GET, METHODS.DELETE, METHODS.PATCH, METHODS.POST];
  RouteMap.prototype.init.isPrivate = true;

  /**
   * Middleware called before model is populated. Overwrite this using [RouteMap.extend()]{@link RouteMap.extend} to apply your own handler.
   * @public
   * @memberof RouteMap
   * @method
   * @param {ExpressRequestObject} req - The request passed from the Express application
   * @param {ExpressResponseObject} res - The response passed from the Express application
   * @param {CallbackFunction} next - The request callback function. This MUST be called, or else the request will stall.
   * @returns {void}
   */
  RouteMap.prototype.beforeModel = function(req, res, next) {
    return next();
  };
  RouteMap.prototype.beforeModel.methods = [METHODS.GET, METHODS.DELETE, METHODS.PATCH];
  
  RouteMap.prototype.findOne = function(req, res, next) {
    debug('findOne() invoked');

    if (!mongoose.Types.ObjectId.isValid(req.params.item_id)) {
      debug(`NotFound pushed to errors stack because ${req.params.item_id} is not a valid MongoDB ID`);
      res.errors.push(res.rg.ERR.NOT_FOUND());
      return next();
    }
    res.rg.Model.findById(req.params.item_id, function(err, item) {
      if (err) { res.errors.push(err); }
      if (!item) { res.errors.push(res.rg.ERR.NOT_FOUND()); debug('NotFound pushed to errors stack'); }
      if (err || !item) {
        return next();
      }
      res.model = item;
      debug(res.model._id);
      next();
    });
  };
  RouteMap.prototype.findOne.methods = [];
  
  RouteMap.prototype.findParent = function(req, res, next) {
    var ParentModel, parentModelName;

    debug('findParent() invoked');
    parentModelName = helpers.toModelName(req.params.parent_resource_type);
    ParentModel = res.rg.mongoose.model(parentModelName);

    ParentModel.findById(req.params.parent_item_id, function(err, parentItem) {
      var reference = _.find(parentItem.constructor.schema.paths, function(path) {        
        return path.options && path.options.ref === res.rg.Model.modelName;
      });

      if (!reference) {
        reference = _.find(res.rg.Model.schema.paths, function(path) {
          return path.options && path.options.ref === parentItem.constructor.modelName;
        });
      }

      if (!reference) {
        return res.errors.push(res.rg.ERR.NOT_FOUND());
      }

      res.parentModel = parentItem;
      next();
    });
  };
  RouteMap.prototype.findParent.methods = []; 
  
  RouteMap.prototype.find = function(req, res, next) {
    debug('find() invoked');
    helpers.querySearch(req, res, function(err, results) {
      if(err) { res.errors.push(err); }
      res.model = results || [];
      next();
    });
  };
  RouteMap.prototype.find.methods = [];
  
  /**
   * Queries the database for a model. Called on GET, PATCH, and DELETE requests. Cannot be overwritten. 
   * @private
   * @param req
   * @param res
   * @param next
   */
  RouteMap.prototype.model = function(req, res, next) {
    var _this = res.rg.currentMap;
    function _getItem(done) {
      _this.findOne(req, res, done);
    }
    
    function _getParent(done) {
      _this.findParent(req, res, done);
    }
    
    if(req.params.parent_item_id && req.params.item_id) {
      async.series([_getItem, _getParent], next);
    } else if (req.params.parent_item_id) {
      _this.findParent(req, res, next);
    } else if (req.params.item_id) {
      _this.findOne(req, res, next);
    } else {
      _this.find(req, res, next);
    }
    
  };
  RouteMap.prototype.model.methods = [METHODS.GET, METHODS.PATCH, METHODS.DELETE];
  RouteMap.prototype.model.isPrivate = true;

  /**
   * Middleware called on GET, PATCH, DELETE requests after the model has been retrieved from the database. The model is accessible in the response object under res.model, and can be modified as required. Overwrite this method with [RouteMap.extend()]{@link RouteMap.extend}
   * @public
   * @memberof RouteMap
   * @method
   * @param {ExpressRequestObject} req - The request passed from the Express application
   * @param {ExpressResponseObject} res - The response passed from the Express application
   * @param {CallbackFunction} next - The request callback function. This MUST be called, or else the request will stall.
   * @returns {void}
   */
  RouteMap.prototype.afterModel = function(req, res, next) {
    return next();
  };
  RouteMap.prototype.afterModel.methods = [METHODS.GET, METHODS.PATCH, METHODS.DELETE];

  /**
   * Hook called on POST requests to create a new object. Cannot be overwritten with RouteMap.prototype.extend()
   * @private
   * @param req
   * @param res
   * @param next
   */
  RouteMap.prototype.createModel = function(req, res, next) {
    function _createItem(done) {
      if (req.data && req.method === METHODS.POST) {
        debug('Create item invoked');
        debug(req.data);
        res.rg.Model.create(req.data, function(err, doc) {
          if (err) { res.errors.push(err); }
          res.model = doc;
          _.set(res, 'rg.status', 201);

          done();
        });
      } else {
        done();
      }
    }

    _createItem(next);
  };
  RouteMap.prototype.createModel.methods = [METHODS.POST];
  RouteMap.prototype.createModel.isPrivate = true;

  /**
   * Hook called on PATCH requests. Updates a model using data provided in the requests. Cannot be overwritten with RouteMap.prototype.extend()
   * @private
   * @param req
   * @param res
   * @param next
   */
  RouteMap.prototype.updateModel = function(req, res, next) {
    function _updateItem(done) {
      debug('Update item invoked');
      _.forEach(req.data, function(value, path) {
        res.model[path] = value;
      });

      res.model.save(function(err, doc) {
        if (err) { res.errors.push(err); }
        res.model = doc;
        done();
      });
    }

    _updateItem(next);
  };
  RouteMap.prototype.updateModel.methods = [METHODS.PATCH];
  RouteMap.prototype.updateModel.isPrivate = true;

  /**
   * Hook called on DELETE requests. Removes the model from the database. Cannot be overwritten with RouteMap.prototype.extend()
   * @param req
   * @param res
   * @param next
   */
  RouteMap.prototype.removeModel = function(req, res, next) {
    function _deleteItem(done) {
      debug('Delete item invoked');
      res.model.remove(function (err) {
        if (err) {
          res.errors.push(err);
        }
        _.set(res, 'rg.status', 204);

        done();
      });
    }

    _deleteItem(next);
  };
  RouteMap.prototype.removeModel.methods = [METHODS.DELETE];
  RouteMap.prototype.removeModel.isPrivate = true;

  /**
   * Middleware called after the model has been removed in a DELETE request. Can be overwritten with [RouteMap.extend()]{@link RouteMap.extend} 
   * @public
   * @memberof RouteMap
   * @method
   * @param {ExpressRequestObject} req - The request passed from the Express application
   * @param {ExpressResponseObject} res - The response passed from the Express application
   * @param {CallbackFunction} next - The request callback function. This MUST be called, or else the request will stall.
   * @returns {void}
   */
  RouteMap.prototype.afterRemove = function(req, res, next) {
    return next();
  };
  RouteMap.prototype.afterRemove.methods = [METHODS.DELETE];

  /**
   * Middleware called on after a new model has been created in a POST request. The new document can be found under `res.model`. Overwrite this method with [RouteMap.extend()]{@link RouteMap.extend}
   * @public
   * @memberof RouteMap
   * @method
   * @param {ExpressRequestObject} req - The request passed from the Express application
   * @param {ExpressResponseObject} res - The response passed from the Express application
   * @param {CallbackFunction} next - The request callback function. This MUST be called, or else the request will stall.
   * @returns {void}
   */
  RouteMap.prototype.afterCreate = function(req, res, next) {
    return next();
  };
  RouteMap.prototype.afterCreate.methods = [METHODS.POST];

  /**
   * Middleware called on PATCH requests after a model has been updated. The updated model can be found under `res.model`. Overwrite this with [RouteMap.extend()]{@link RouteMap.extend}
   * @public
   * @memberof RouteMap
   * @method
   * @param {ExpressRequestObject} req - The request passed from the Express application
   * @param {ExpressResponseObject} res - The response passed from the Express application
   * @param {CallbackFunction} next - The request callback function. This MUST be called, or else the request will stall.
   * @returns {void}
   */
  RouteMap.prototype.afterUpdate = function(req, res, next) {
    return next();
  };
  RouteMap.prototype.afterUpdate.methods = [METHODS.PATCH];

  /**
   * Private hook that prepares a response by running `res.model` through the JSON API serializer. Cannot be overwritten with RouteMap.prototype.extend()
   * @private
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteMap.prototype.setupResponse = function(req, res, next) {
    var pagination, basePageLink, totalPages;
    if (res.errors.length) {
      return next();
    }
    
    res.data = { data: ((!Array.isArray(res.model) && typeof res.model === 'object') || (Array.isArray(res.model) && res.model.length)) ? helpers.serialize(res.model) : ((res.model === []) ? [] : null )};
    
    if (Array.isArray(res.model) && req.pageNumber && !_.isNaN(req.pageNumber)) {
      basePageLink = '/' + helpers.toResourceType(res.rg.Model.modelName);
      totalPages = Math.ceil(res.meta.total / req.perPage);
      pagination = {
        first: basePageLink + '?page=' + req.pageNumber,
        last: basePageLink + '?page=' + totalPages,
        next: basePageLink + '?page=' + (req.pageNumber + 1),
        prev: (req.pageNumber > 1 ? basePageLink + '?page=' + req.pageNumber - 1 : null)
      };
      _.assign(res.data, { links: pagination, meta: { total: res.meta.total, total_pages: totalPages, page: req.pageNumber, per_page: req.perPage }});
    }
    
    return next();
  };
  RouteMap.prototype.setupResponse.methods = [METHODS.POST, METHODS.GET, METHODS.DELETE, METHODS.PATCH];
  RouteMap.prototype.setupResponse.isPrivate = true;

  /**
   * Middleware called on all requests (GET, POST, PATCH, DELETE) just before the response is sent. The serialized data is contained in res.data. Can be extend with [RouteMap.extend()]{@link RouteMap.extend}
   * @public
   * @memberof RouteMap
   * @method
   * @param {ExpressRequestObject} req - The request passed from the Express application
   * @param {ExpressResponseObject} res - The response passed from the Express application
   * @param {CallbackFunction} next - The request callback function. This MUST be called, or else the request will stall.
   * @returns {void}
   */
  RouteMap.prototype.beforeResponse = function(req, res, next) {
    return next();
  };
  RouteMap.prototype.beforeResponse.methods = [METHODS.POST, METHODS.GET, METHODS.DELETE, METHODS.PATCH];

  /**
   * Private middleware that sends the actual response, but only if the res.errors array is empty. Otherwise exits out of the event loop. This method cannot be overwritten with RouteMap.extend()
   * @private
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteMap.prototype.sendResponse = function(req, res, next) {
    var status = res.rg.status || 200;
    if (!res.errors || !res.errors.length) {
      res.status(status).json(res.data);
    }
    
    return next();
  };
  RouteMap.prototype.sendResponse.methods = [METHODS.POST, METHODS.GET, METHODS.DELETE, METHODS.PATCH];
  RouteMap.prototype.sendResponse.isPrivate = true;
  
  return RouteMap;
}());

module.exports = Object.create(RouteMap.prototype);