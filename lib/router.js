var express = require('express');
var _ = require('lodash');
var querySearch = require('./query-search');
var decamelize =  require('decamelize');
var pluralize = require('pluralize');
var camel = require('to-camel-case');
var mongoose = require('mongoose');

var RouterFactory = (function() {
  /**
   * Turns a JSON API resource type string (e.g. people) into a mongoose-friendly model name (e.g. Person)
   * @param {string} resourceType - Returns a JSON API resource name as a Mongoose Model string
   * @returns {string} - The Mongoose Model
   */
  function toModelName(resourceType) {
    return pluralize(resourceType.charAt(0).toUpperCase() + camel(resourceType).substr(1), 1);
  }

  /**
   * Turns a Mongoose model name (e.g. Person) into a JSON API resource type (e.g. people)
   * @param {string} modelName - The name of the model to convert
   * @returns {string} - A JSON API resource type
   */
  function toResourceType(modelName) {
    return pluralize(decamelize(modelName), 2).toLowerCase();
  }

  /**
   * Returns a new attributes object containing the data from a relationship
   * @param {object} attributes
   * @param {object} relationships
   * @returns {object} obj - A copy of attributes containing the relationship ids at the appropriate paths
   */
  function insertEmbeddedRelationshipsIntoAttributes(attributes, relationships) {
    // Clone attributes object so that we do not mutate the original object
    var obj = Object.assign({}, attributes);

    _.forEach(relationships, function(rel, key) {
      var prop = {};
      if (Array.isArray(rel.data)) {
        prop[key] = _.map(rel, 'id');
      } else {
        prop[key] = rel.id;
      }
      Object.assign(obj, prop);
    });

    return obj;
  }

  /**
   *
   * @param {mongoose.document} doc - Turns a model into a legal JSON API representation
   */
  function toJSONAPIObject(doc) {
    var Model = doc.constructor;
    var attribs = doc.toObject({ getters: true, versionKey: false, depopulate: true });
    var obj = { id: attribs.id || doc._id.toString(), type: toResourceType(Model.modelName) };

    _.forEach(Model.schema.paths, function(p, name) {
      /* TODO Also populate the links object with related items */
      if (!p.options.ref) {
        return;
      }

      if (obj.hasOwnProperty('relationships') === false) {
        obj.relationships = {};
      }

      obj.relationships[name] = { type: toResourceType(p.options.ref), id: attribs[name] };
      // Remove path from attributes object
      delete attribs[name];
    });

    // Remove ids from attributes
    delete attribs.id;
    delete attribs._id;

    obj.attributes = attribs;
    return obj;
  }

  /**
   * @param {mongoose.Model} Model - The mongoose model to base the routes on
   * @param {mongoose.Model} [ParentModel] - Parent mongoose Model the Model is a child of.
   */
  return function(Model, ParentModel) {
    var _router = express.Router();
    var resourceName = pluralize(decamelize(Model.modelName, '-'), 2).toLowerCase();
    var hasParent = Boolean(ParentModel);
    var baseRequestURL = hasParent === true ? '/:parent/' + resourceName + '/' : '/';
    var parentPath;

    if (hasParent) {
      parentPath = _.findKey(Model.schema.paths, function(p) {
        return p.options.ref === ParentModel.modelName;
      });
    }

    if (hasParent) {
      _router.param('parent', function(req, res, next) {
        var parentQuery = {};
        ParentModel.findById(req.params.parent, function(err, parent) {
          if (!parent) {
            return res.__onError(req, res, { message: 'Could not find parent resource', name: 'NotFound' });
          }
          // Filter by parent object if a query is passed with the request
          if (req.method === 'GET') {
            if (!req.query) {
              req.query = {};
            }
            parentQuery[parentPath] = parent._id;
            Object.assign(req.query, parentQuery);
          }
          req.params.parent = parent;
          next();
        });
      });
    }

    /**
     * @param route (returns id)
     */
    _router.param('item', function(req, res, next) {
      Model.findById(req.params.item).exec(function(err, item) {
        if (!item || (hasParent && req.params.parent._id.equals(item[parentPath]) === false)) {
          return res.__onError(req, res, { message: 'Could not find resource', name: 'NotFound' });
        }
        req.params.item = item;
        next();
      });
    });

    /**
     * @GET route
     */
    _router.get(baseRequestURL, function(req, res) {
      querySearch(Model, req.query || {}, function(err, results) {
        var formattedResults;
        if (err) {
          return res.__onError(req, res, err);
        }

        formattedResults = _.map(results.data, function(result) {
          return toJSONAPIObject(result);
        });

        res.json({ meta: results.meta, data: formattedResults });
      });
    });

    /**
     * @GET One route
     */
    _router.get(baseRequestURL + ':item', function(req, res) {
      res.json({ data: toJSONAPIObject(req.params.item) });
    });

    /**
     * @POST route (create)
     */
    _router.post(baseRequestURL, function(req, res) {
      var obj = req.body.data;
      var attributes;

      if (!obj || obj.hasOwnProperty('attributes') === false) {
        return res.__onError(req, res, { name: 'BadRequest', message: 'Request not a JSON object or attributes property missing' });
      }

      attributes = obj.attributes;

      // Assign related items populated in the relationships field, if provided
      if (obj.hasOwnProperty('relationships')) {
        attributes = insertEmbeddedRelationshipsIntoAttributes(attributes, obj.relationships);
      }

      if (hasParent && attributes.hasOwnProperty('parentPath') === false) {
        attributes[parentPath] = req.params.parent._id;
      }

      Model.create(attributes, function(err, doc) {
        if (err) {
          return res.__onError(req, res, err);
        }
        var obj = toJSONAPIObject(doc);

        res.status(201).json({ data: obj });
      });
    });

    /**
     * @PATCH route (update resource)
     */
    _router.patch(baseRequestURL + ':item', function(req, res) {
      var data = req.body.data;
      var item = req.params.item;
      var attributes;

      if (!data || !data.attributes) {
        return res.__onError(req, res, { name: 'BadRequest', message: 'Request not an object or missing attributes property'});
      }

      attributes = Object.assign({}, data.attributes);

      // If related items have been updated, populate into attributes
      if (req.body.data.relationships) {
        attributes = insertEmbeddedRelationshipsIntoAttributes(attributes, _.pickBy(req.body.data.relationships, function(o, k) {
          return Object.keys(Model.schema.paths).indexOf(k) >= 0;
        }));
      }

      Object.assign(item, attributes);

      item.save(function(err, doc) {
        if (err) {
          return res.__onError(req, res, err);
        }

        res.json({ data: toJSONAPIObject(doc) });
      });
    });

    /**
     * @DELETE route (remove)
     */
    _router.delete(baseRequestURL + ':item', function(req, res) {
      var item = req.params.item;

      item.remove(function(err) {
        if (err) {
          return res.__onError(req, res, err);
        }

        res.status(200).json({});
      });
    });

    return _router;
  };
}());

module.exports = RouterFactory;