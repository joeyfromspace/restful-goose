var helpers = require('./helpers');
var ERR = require('./error-handler');
var async = require('async');
var _ = require('lodash');
var debug = require('debug')('restful-goose:RouteMap');
var mongoose = require('mongoose');

/**
 * @class RouteMap
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
    var map = _.assign({}, RouteMap.prototype);
    var privateKeys = _.chain(RouteMap.prototype).filter(function(v) {
      return v.isPrivate;
    }).keys().value();
    var filteredProperties = _.chain(properties).omit(privateKeys).mapValues(function(v, k) {
      v.methods = RouteMap.prototype[k].methods;
      return v;
    }).value();

    map = _.mapValues(map, function(v, k) {
      if (filteredProperties[k]) {
        return filteredProperties[k];
      } else {
        return v;
      }
    });
    return map;
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

    if (req.method === METHODS.PATCH) {
      debug(req.body);
    }

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
    if (req.method === METHODS.PATCH) {
      debug(req.data);
    }
    return next();
  };
  RouteMap.prototype.beforeModel.methods = [METHODS.GET, METHODS.DELETE, METHODS.POST, METHODS.PATCH];

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

  RouteMap.prototype.findRelationship = function(req, res, next) {
    var ParentModel, parentModelName;
    var relationshipPath = _.camelCase(req.params.relationship_type);
    debug('findRelationship() invoked');

    parentModelName = helpers.toModelName(req.params.resource_type);
    ParentModel = res.rg.mongoose.model(parentModelName);
    ParentModel.findById(req.params.parent_item_id, function(err, parentItem) {
      //res.parentModel = parentItem;
      var schemaPath = ParentModel.schema.path(req.params.relationship_type);
      res.relationshipPath = relationshipPath;
      res.relRef = _.get(schemaPath, 'options.ref');
      res.parentModel = parentItem;
      if (req.method === METHODS.GET) {
        debug(req.params.relationship_type);
        debug(relationshipPath);
        debug(parentItem[relationshipPath]);
        debug(req.params.item_id);
      }

      res.model = Array.isArray(parentItem[relationshipPath]) && req.params.item_id ? _.find(parentItem[relationshipPath], function(item) {
        return item.toString() === req.params.item_id;
      }) : parentItem[relationshipPath];
      next();
    });
  };
  RouteMap.prototype.findRelationship.methods = [];

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

    if (req.params.relationship_type) {
      debug('Get relationship');
      res.hasParent = true;
      _this.findRelationship(req, res, next);
    } else if (req.params.item_id && req.method !== METHODS.POST) {
      debug('Get one');
      res.hasParent = false;
      _this.findOne(req, res, next);
    } else if (req.method !== METHODS.POST) {
      debug('Get many');
      res.hasParent = false;
      _this.find(req, res, next);
    } else {
      next();
    }

  };
  RouteMap.prototype.model.methods = [METHODS.GET, METHODS.PATCH, METHODS.POST, METHODS.DELETE];
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
    function _createRelationship(done) {
      debug('Adding new relationship invoked');

      var update = Array.isArray(req.data) ? req.data : [req.data.id];
      var pathName = res.relationshipPath;
      var existingIds = Array.isArray(res.parentModel[pathName]) ? _.invokeMap(res.parentModel[pathName], 'toString') : [res.parentModel[pathName]];

      if (Array.isArray(res.parentModel[pathName])) {
        debug('isArray');
        res.parentModel[pathName] = _.chain(existingIds).concat(update).uniq().value();
      } else {
        res.parentModel[pathName] = _.head(update);
      }

      res.parentModel.save(function(err, doc) {
        if (err) { res.errors.push(err); }
        res.model = doc[pathName];
        _.set(res, 'rg.status', 202);
        done();
      });
    }
    function _createItem(done) {
      if (req.data) {
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

    if (res.hasParent) {
      _createRelationship(next);
    } else {
      _createItem(next);
    }

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
    function _updateRelationship(done) {
      debug('Update relationship invoked');
      debug(req.data);
      var data = Array.isArray(req.data) ? req.data : req.data.id;
      res.parentModel[res.relationshipPath] = data;

      res.parentModel.save(function(err, doc) {
        if (err) { res.errors.push(err); }
        res.model = doc[res.relationshipPath];
        done();
      });
    }

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

    if (res.hasParent) {
      _updateRelationship(next);
    } else {
      _updateItem(next);
    }
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
    function _deleteRelationship(done) {
      var resourceType = res.relationshipPath;
      var hasId = Boolean(req.params.item_id);

      if (req.data) {
        res.parentModel[resourceType] = _.reject(res.parentModel[resourceType], function(item) {
          if (_.isNil(item)) {
            return true;
          } else {
            return Array.isArray(req.data) ? req.data.indexOf(item.toString()) >= 0 : item.toString() === req.data;
          }
        });
      } else {
        res.parentModel[resourceType] = hasId && Array.isArray(res.parentModel[resourceType]) ? _.reject(res.parentModel[resourceType], function(item) {
          return item.toString() === req.params.item_id;
        }) : (Array.isArray(res.parentModel[resourceType]) ? [] : undefined);
      }

      res.parentModel.save(function(err, doc) {
        if (err) { res.errors.push(err); }
        res.model = doc[resourceType];
        _.set(res, 'rg.status', 202);
        done();
      });
    }
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

    if (res.hasParent) {
      _deleteRelationship(next);
    } else {
      _deleteItem(next);
    }
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
   * Private hook that runs queries for included objects
   * @private
   * @param req
   * @param res
   * @param next
   * @returns {*}
   */
  RouteMap.prototype.getIncludes = function(req, res, next) {
    function _find(model, callback) {
      var includes = _.chain(req.query.include).split(',').value();
      res.included = [];

      debug('Pulling ' + includes.length + ' includes from the db...');
      async.each(includes, function(include, done) {
        var includeArray;
        var baseInclude = include.split('.')[0];
        var basePath = _.camelCase(baseInclude);
        var schemaPath = model.schema.path(basePath);
        var IncludeModel = res.rg.mongoose.model(_.get(schemaPath, 'options.ref'));
        var val = model[basePath];
        var op = Array.isArray(val) ? 'find' : 'findById';
        var p = Array.isArray(val) ? { _id: { $in: val }} : val;
        var opts = {};

        if (include.indexOf('.') >= 0) {
          includeArray = include.split('.');
          opts = { populate: includeArray.shift().join(' ')[0] };
        }

        IncludeModel[op](p, opts, function(err, result) {
          if (err) {
            return done(err);
          }

          if (op === 'find' && result.length) {
            if (opts.populate) {
              _.forEach(result, function(i) {
                var val = _.get(i, opts.populate);
                if (Array.isArray(val)) {
                  res.included = _.concat(res.included, helpers.serialize(val));
                  _.set(i, opts.populate, _.map(val, '_id'));
                } else {
                  res.included.push(helpers.serialize(val));
                  _.set(i, opts.populate, val._id);
                }
              });
            }
            res.included = _.concat(res.included, helpers.serialize(result));
          } else {
            res.included.push(helpers.serialize(result));
          }

          done();
        });
      }, function(err) {
        if (err) {
          debug(err);
          return callback(err);
        }

        res.included = _.uniq(res.included);
        debug('Populated ' + res.included.length + ' documents from include');
        callback();
      });
    }

    // TODO Get includes working properly
    //return next();

    if (!req.query.include) {
      return next();
    }

    debug('Includes found: ' + req.query.include);

    if (Array.isArray(res.model)) {
      async.each(res.model, _find, function(err, items) {
        if (err) {
          return next(err);
        }

        res.model = items;
        next();
      });
    } else {
      _find(res.model, function(err) {
        if (err) {
          return next(err);
        }

        next();
      });
    }
  };
  RouteMap.prototype.getIncludes.methods = [METHODS.GET];
  RouteMap.prototype.getIncludes.isPrivate = true;

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

    res.data = { data: helpers.serialize(res.model, req.params.relationship_type, res.relRef) };

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

    if (res.included && res.included.length) {
      res.data.included = res.included;
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
