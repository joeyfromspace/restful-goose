var _ = require('lodash');
var pluralize = require('pluralize');
var debug = require('debug')('restful-goose:helpers');

module.exports = (function() {
  'use strict';

  /**
   * Returns a copy of a string as a JSON API resource type
   * @param {string} str
   * @returns {*}
   */
  var toResourceType = function(str) {
    return pluralize(_.kebabCase(str), 2);
  };
  /**
   * Returns a copy of a string represented as a Mongoose model name
   * @param {string} str
   * @returns {*}
   */
  var toModelName = function(str) {
    return pluralize(str.charAt(0).toUpperCase() + _.camelCase(str.substr(1)), 1);
  };
  /**
   * Returns a JSON API compliant link object constructed from a Mongoose model name and an id
   * @param {string} modelName - The name of the model
   * @param {string|mongoose.ObjectId} id - The id of the entity
   * @returns {{type, id: *, link: string}}
   */
  var toLinkObject = function(modelName, id) {
    if (id.toString) {
      id = id.toString();
    }
    return { self: '/' + toResourceType(modelName) + '/' + id };
  };
  /**
   * Return a copy of an object with all the object's property keys converted into kebab-case
   * @param {object} o
   * @returns {*}
   */
  var keysToKebab = function(o) {
    return _.chain(o).mapKeys(function(v, k) {
      return _.kebabCase(k);
    }).mapValues(function(v) {
      if (typeof v === 'object' && v instanceof Date === false && _.isNull(v) === false && !Array.isArray(v)) {
        return keysToKebab(v);
      } else {
        return v;
      }
    }).value();
  };
  /**
   * Return a copy of an object with all the object's property keys converted into camelCase
   * @param {object} o
   * @returns {*}
   */
  var keysToCamel = function(o) {
    return _.chain(o).mapKeys(function(v, k) {
      return _.camelCase(k);
    }).mapValues(function(v) {
      if (typeof v === 'object' && v instanceof Date === false && _.isNull(v) === false && !Array.isArray(v)) {
        return keysToCamel(v);
      } else {
        return v;
      }
    }).value();
  };

  /**
   * Accepts a single Mongoose document or an array of Mongoose documents and converts them into JSON API objects
   * @param {mongoose.Document[]|mongoose.Document} doc - A Mongoose document or an array of documents to process
   * @returns {object[]|object} Documents prepared for sending via JSON API
   */
  var serialize = function(doc, relationshipType, relReference) {
    debug('serializer invoked');
    if (relationshipType && relReference) {
      debug('Relationship detected');
      debug(relationshipType);
      debug(relReference);
      if (Array.isArray(doc)) {
        return _.map(doc, function(item) {
          return { id: item, type: toResourceType(relReference) };
        });
      } else {
        return { id: doc, type: toResourceType(relReference) };
      }
    }
    if(!doc) {
      return;
    }
    debug(doc.toObject ? doc.toObject() : '');

    if (Array.isArray(doc)) {
      return _.map(doc, function(item) {
        return serialize(item);
      });
    }
    var Model = doc.constructor;
    var omitted = [ 'id' ];

    Model.schema.eachPath(function(pathName) {
      if (_.startsWith(pathName, '_')) {
        omitted.push(pathName);
      }
    });
    var relationships = _.chain(Model.schema.paths).filter(function (path) {
      return path.options && path.options.ref;
    }).map(function (path) {
      omitted.push(path.path);
      return { path: path.path, ref: path.options.ref };
    }).value();
    var serialized = { type: toResourceType(Model.modelName), id: doc._id.toString() };
    var raw = doc.toObject();
    raw = _.omit(raw, omitted);

    serialized.attributes = raw;

    _.forEach(relationships, function (rel) {
      if (doc[rel.path] && Array.isArray(doc[rel.path]) && doc[rel.path].length) {
        var relationship = { links: { self: '/' + serialized.type + '/' + doc.id + '/relationships/' + toResourceType(rel.ref) }};
        relationship.data = _.map(doc[rel.path], function(id) {
          return { type: toResourceType(rel.ref), id: id.toString() };
        });
        _.set(serialized, 'relationships.' + rel.path, relationship);
      } else if (doc[rel.path] && !Array.isArray(doc[rel.path])) {
        _.set(serialized, 'relationships.' + rel.path, { data: { type: toResourceType(rel.ref), id: doc[rel.path].toString() }, links: toLinkObject(rel.ref, doc[rel.path]) });
      }
    });

    serialized.links = toLinkObject(Model.modelName, doc._id);
    serialized.links.type = 'self';

    return keysToKebab(serialized);
  };

  /**
   * Deserializer accepts a JSON-API encoded object and converts it into a standard JavaScript Object for easier processing
   * @param {object} data - A data object stored in JSON API
   * @returns {object} - Deserialized object
   */
  var deserialize = function(data) {
    debug('deserializer invoked');
    debug(data);
    data = data.data ? data.data : data;
    if (Array.isArray(data) && Object.keys(data[0]).length === 2) {
      return _.map(data, function(item) {
        return item.id;
      });
    } else if (Array.isArray(data)) {
      return _.map(data, deserialize);
    }

    var o = keysToCamel(data);
    var relationships = {};
    var deserialized = {};

    _.forEach(o.relationships, function(value, modelPath) {
      relationships[modelPath] = value.data && Array.isArray(value.data) ? _.map(value.data, 'id') : value.data.id;
    });

    if (o.attributes) {
      Object.assign(deserialized, o.attributes);
    }

    if (o.id) {
      deserialized.id = o.id;
    }

    if (Object.keys(relationships).length) {
      Object.assign(deserialized, relationships);
    }

    return deserialized;
  };

  /**
   * Queries the database, applying req.query to teh query and populates the results into res.model
   * @param {object} req
   * @param {object} res
   * @param {function} next
   */
  var querySearch = function(req, res, next) {
    var optionPaths = ['page', 'per_page', 'filter', 'sort'];
    var query = _.omit(req.query, optionPaths);
    var options = {};
    var sort = req.query.sort ? _.replace(req.query.sort, ',', ' ') : {};
    var pagination;
    debug('helpers.querySearch invoked');

    req.pageNumber = req.query.page ? parseInt(req.query.page, 10) : undefined;
    req.perPage = parseInt(req.query.per_page, 10) || 25;
    pagination = req.pageNumber && !_.isNaN(req.pageNumber) ? { skip: ((req.pageNumber * req.perPage) - req.perPage), limit: req.perPage } : {};

    if (req.query.filter) {
      _.assign(query, req.query.filter);
    }

    Object.assign(options, sort, pagination);
    debug('Query details:');
    debug('================');
    debug('Model: ' + res.rg.Model.modelName);
    debug('Database: ' + res.rg.Model.db.db.databaseName);
    debug('Query object:');
    debug(query);
    debug('Options object:');
    debug(options);
    debug('================');
    res.rg.Model.find(query, null, options, function(err, results) {
      if (err) {
        debug('Error at query:');
        debug(err);
      }

      debug('Results: ' + results.length + ' objects');


      res.rg.Model.count(query, function (err, count) {
        _.set(res, 'meta.total', count);
        next(err, results);
      });
    });
  };

  return {
    toResourceType: toResourceType,
    deserialize: deserialize,
    serialize: serialize,
    toModelName: toModelName,
    toLinkObject: toLinkObject,
    querySearch: querySearch,
    keysToKebab: keysToKebab,
    keysToCamel: keysToCamel
  };

}());
