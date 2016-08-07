var helpers = require('./helpers');
var ERR = require('./errors');
var async = require('async');
var _ = require('lodash');
var debug = require('debug')('restful-goose:RouteMap');

var RouteHandler = (function() {
  'use strict';
  var METHODS = {
    DELETE: 'DELETE',
    PATCH: 'PATCH',
    POST: 'POST',
    GET: 'GET'
  };

  /**
   * @class RouteHandler
   * Interfaces with a Mongoose model to handle API requests for a single object or a collection of objects
   */
  var RouteHandler = Object.create(null);

  /**
   * Returns a fresh copy of RouteHandler with your provided hash of functions. Use this to replace the default event handlers with your own.
   * @method
   * @public
   * @param {object} properties - A hash of functions with handlers for various events, called during invocation
   */
  RouteHandler.extend = function(properties) {
    var privateKeys = _.chain(RouteHandler).filter(function(v) {
      return v.isPrivate;
    }).keys().value();
    debug(privateKeys);
    var filteredProperties = _.chain(properties).omit(privateKeys).mapValues(function(v, k) {
      v.methods = RouteHandler[k].methods;
      return v;
    }).value();
    debug(filteredProperties);
    return _.assign({}, RouteHandler, filteredProperties);
  };
  RouteHandler.extend.methods = [];
  RouteHandler.extend.isPrivate = true;

  /**
   * Function responsible for binding internal variables to the req/res object for use in future events
   * @method
   * @private
   * @param {express.Request} req
   * @param {express.Response} res
   * @param {function} next - Callback function for when routing is complete
   */
  RouteHandler.init = function(req, res, next) {
    Object.assign(res.rg, {
      Model: res.rg.mongoose.model(helpers.toModelName(req.params.resource_type)),
      search: helpers.querySearch,
      serialize: helpers.serialize,
      deserialize: helpers.deserialize
    });
    res.ERR = ERR;
    res.errors = [];

    if (_.keys(req.body).length) {
      req.data = helpers.deserialize(req.body);
    }

    next();
  };
  RouteHandler.init.methods = [METHODS.GET, METHODS.DELETE, METHODS.PATCH, METHODS.POST];
  RouteHandler.init.isPrivate = true;

  /**
   * Event called before model is populated. Overwrite this using RouteHandler.extend({}) to apply your own handler.
   * @public
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.beforeModel = function(req, res, next) {
    return next();
  };
  RouteHandler.beforeModel.methods = [METHODS.GET, METHODS.DELETE, METHODS.PATCH];

  /**
   * Queries the database for a model. Called on GET, PATCH, and DELETE requests. Cannot be overwritten. 
   * @private
   * @param req
   * @param res
   * @param next
   */
  RouteHandler.model = function(req, res, next) {
    function _getItem(done) {
      if (!req.params.item_id) {
        return done();
      }
      
      debug('Get Item invoked');
      res.rg.Model.findById(req.params.item_id, function(err, item) {
        if (err) { res.errors.push(err); }
        res.model = item;
        debug(res.model._id);
        done();
      });
    }
    
    function _getParentItem(done) {
      var ParentModel, parentModelName;
      
      if (!req.params.parent_item_id) {
        return done();
      }
      
      debug('Get parent item invoked');
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
          return res.errors.push(res.ERR.NOT_FOUND);
        }
        
        res.parentModel = parentItem;
        done();
      });
    }
    
    function _getItemList(done) {
      if (req.params.item_id || req.method !== METHODS.GET) {
        return done();
      }
      debug('Get Item List invoked');
      helpers.querySearch(req, res, function(err, results) {
        if(err) { res.errors.push(err); }
        res.model = results || [];
        done();
      });
    }
    
    if(req.params.parent_item_id && req.params.item_id) {
      async.series([_getItem, _getParentItem], next);
    } else if (req.params.parent_item_id) {
      _getParentItem(next);
    } else if (req.params.item_id) {
      _getItem(next);
    } else {
      _getItemList(next);
    }
    
  };
  RouteHandler.model.methods = [METHODS.GET, METHODS.PATCH, METHODS.DELETE];
  RouteHandler.model.isPrivate = true;

  /**
   * Function called on GET, PATCH, DELETE requests after the model has been retrieved from the database. The model is accessible in the response object as `res.model`, and can be modified as required. Overwrite this method with RouteMap.extend()
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.afterModel = function(req, res, next) {
    return next();
  };
  RouteHandler.afterModel.methods = [METHODS.GET, METHODS.PATCH, METHODS.DELETE];

  /**
   * Hook called on POST requests to create a new object. Cannot be overwritten with RouteMap.extend()
   * @private
   * @param req
   * @param res
   * @param next
   */
  RouteHandler.createModel = function(req, res, next) {
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
  RouteHandler.createModel.methods = [METHODS.POST];
  RouteHandler.createModel.isPrivate = true;

  /**
   * Hook called on PATCH requests. Updates a model using data provided in the requests. Cannot be overwritten with RouteMap.extend()
   * @private
   * @param req
   * @param res
   * @param next
   */
  RouteHandler.updateModel = function(req, res, next) {
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
  RouteHandler.updateModel.methods = [METHODS.PATCH];
  RouteHandler.updateModel.isPrivate = true;

  /**
   * Hook called on DELETE requests. Removes the model from the database. Cannot be overwritten with RouteMap.extend()
   * @param req
   * @param res
   * @param next
   */
  RouteHandler.removeModel = function(req, res, next) {
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
  RouteHandler.removeModel.methods = [METHODS.DELETE];
  RouteHandler.removeModel.isPrivate = true;

  /**
   * Hook called on DELETE requests after the model has been removed from the database. Can be overwritten with RouteMap.extend() 
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.afterRemove = function(req, res, next) {
    return next();
  };
  RouteHandler.afterRemove.methods = [METHODS.DELETE];

  /**
   * Hook called on POST requests after a new model has been created. The new document can be found under `res.model`.
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.afterCreate = function(req, res, next) {
    return next();
  };
  RouteHandler.afterCreate.methods = [METHODS.POST];

  /**
   * Hook called on PATCH requests after a model has been updated. The updated model can be found under `res.model`.
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.afterUpdate = function(req, res, next) {
    return next();
  };
  RouteHandler.afterUpdate.methods = [METHODS.PATCH];

  /**
   * Private hook that prepares a response by running `res.model` through the JSON API serializer. Cannot be overwritten with RouteMap.extend()
   * @private
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.setupResponse = function(req, res, next) {
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
  RouteHandler.setupResponse.methods = [METHODS.POST, METHODS.GET, METHODS.DELETE, METHODS.PATCH];
  RouteHandler.setupResponse.isPrivate = true;

  /**
   * Hook called on all requests (GET, POST, PATCH, DELETE) just before the response is sent. The serialized data is contained in `res.data`.
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.beforeResponse = function(req, res, next) {
    return next();
  };
  RouteHandler.beforeResponse.methods = [METHODS.POST, METHODS.GET, METHODS.DELETE, METHODS.PATCH];

  /**
   * Private hook that sends the actual response, but only if the `res.errors` array is empty. Otherwise exits out of the event loop. This method cannot be overwritten with RouteMap.extend()
   * @private
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteHandler.sendResponse = function(req, res, next) {
    var status = res.rg.status || 200;
    if (!res.errors || !res.errors.length) {
      res.status(status).json(res.data);
    }
    
    return next();
  };
  RouteHandler.sendResponse.methods = [METHODS.POST, METHODS.GET, METHODS.DELETE, METHODS.PATCH];
  RouteHandler.sendResponse.isPrivate = true;
  
  return RouteHandler;
}());

module.exports = RouteHandler;