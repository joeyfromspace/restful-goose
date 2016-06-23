var express = require('express');
var _ = require('lodash');
var querySearch = require('./query-search');
var pluralize = require('pluralize');
var helpers = require('./helpers');


var RouterFactory = (function() {
  
  /**
   * @param {mongoose.Model} Model - The mongoose model to base the routes on
   * @param {string} [fullLink] - The full URL of the resource. For populating links. 
   */
  return function(mongoose, Model) {
    var _router = express.Router();
    var baseRequestURL = '/';

    /**
     * @param route (returns id)
     */
    _router.param('item', function(req, res, next) {
      Model.findById(req.params.item).exec(function(err, item) {
        if (!item) {
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
      if (req.parent && req.parentPath) {
        console.log('hasParent');
        if (!req.query) {
          req.query = {};
        }
        console.log('parentPath: ' + req.parentPath);
        req.query[req.parentPath] = req.parent._id;
      }
      querySearch(mongoose, Model, req.query || {}, function(err, results) {
        var formattedResults;
        if (err) {
          return res.__onError(req, res, err);
        }

        formattedResults = _.map(results.data, function(result) {
          return helpers.toJSONAPIObject(result, req.baseURL);
        });

        res.json({ meta: results.meta, data: formattedResults });
      });
    });

    /**
     * @GET One route
     */
    _router.get(baseRequestURL + ':item', function(req, res) {
      res.json({ data: helpers.toJSONAPIObject(req.params.item, req.baseURL) });
    });

    /**
     * @POST route (create)
     */
    _router.post(baseRequestURL, function(req, res) {
      var obj = req.body.data;
      var attributes;
      
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch(e) {
          return res.__onError(req, res, { name: 'BadRequest' });
        }
      }

      if (!obj || (obj.hasOwnProperty('attributes') === false && obj.hasOwnProperty('relationships') === false)) {
        return res.__onError(req, res, { name: 'BadRequest', message: 'Request not a JSON object or attributes property missing' });
      }

      attributes = obj.attributes;
      if(req.parent && req.parentPath) {
        if (!obj.relationships) {
          obj.relationships = {};
        }
        obj.relationships[req.parentPath] = { data: { type: helpers.toResourceType(req.parent.constructor), id: req.parent.id }};
      }

      // Assign related items populated in the relationships field, if provided
      if (obj.hasOwnProperty('relationships')) {
        attributes =  helpers.insertEmbeddedRelationshipsIntoAttributes(attributes, obj.relationships);
      }

      Model.create(attributes, function(err, doc) {
        if (err) {
          return res.__onError(req, res, err);
        }
        var obj = helpers.toJSONAPIObject(doc, req.baseURL);

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

      if (!data || (data.hasOwnProperty('attributes') === false && data.hasOwnProperty('relationships') === false)) {
        return res.__onError(req, res, { name: 'BadRequest', message: 'Request not an object or missing attributes property', detail: { request_body: req.body }});
      }

      attributes = Object.assign({}, _.mapKeys(data.attributes, function(v,k) {
        return _.camelCase(k);
      }));

      // If related items have been updated, populate into attributes
      if (req.body.data.relationships) {
        attributes =  helpers.insertEmbeddedRelationshipsIntoAttributes(attributes, _.pickBy(req.body.data.relationships, function(o, k) {
          return Object.keys(Model.schema.paths).indexOf(k) >= 0;
        }));
      }

      Object.assign(item, attributes);

      item.save(function(err, doc) {
        if (err) {
          return res.__onError(req, res, err);
        }

        res.json({ data: helpers.toJSONAPIObject(doc, req.baseURL) });
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

        res.status(204).send();
      });
    });

    return _router;
  };
}());

module.exports = RouterFactory;