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
   * @param {string} preamble - A prefix to apply to links (e.g. /api)
   * @returns {{type, id: *, link: string}}
   */
  var toLinkObject = function(modelName, id, preamble) {
    var prefix = preamble ? '/' + preamble : '';
    if (id.toString) {
      id = id.toString();
    }
    
    return { self: prefix + '/' + toResourceType(modelName) + '/' + id };
  };
  /**
   * Accepts a modelName and a mongodb ObjectID and converts them into a json-api compliant relationship object
   * @param {string} modelName - The name of the model
   * @param {mongoose.ObjectId|string} objectId - The id of the entity
   * @returns {{type, id: * }}
   */
  var toRelationshipObject = function(modelName, objectId) {
    var oid = _.isString(objectId) ? oid : objectId.toString();
    return { type: toResourceType(modelName), id: oid };
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
   * @param {string} [relationshipType] - A string of the path on the relationship object where the final object resides
   * @param {string} [relReference] - The model name of the related object
   * @returns {object[]|object} Documents prepared for sending via JSON API
   */
  var serialize = function(doc, relationshipType, relReference) {
    debug('serializer invoked');

    // If serializer is invoked with relationship data, we only partially serialize these
    if (relationshipType && relReference) {
      debug('Relationship detected');
      debug(relationshipType);
      debug(relReference);
      if (Array.isArray(doc)) {
        return _.map(doc, function(item) {
          return toRelationshipObject(relReference, item);
        });
      } else {
        return toRelationshipObject(relReference, doc);
      }
    }

    // If somehow an empty doc ends up here, do not attempt to serialize it (sometimes happen when null values are stored in arrays)
    if(!doc) {
      return;
    }
    debug(doc.toObject ? doc.toObject() : '');
    
    // Serialize an array of docs recursively
    if (Array.isArray(doc)) {
      return _.map(doc, function(item) {
        return serialize(item);
      });
    }
    var Model = doc.constructor;
    var omitted = [ 'id' ];

    // Suppress pathnames that start with underscores from being serialized, as these are usually internal/system paths
    Model.schema.eachPath(function(pathName) {
      if (_.startsWith(pathName, '_')) {
        omitted.push(pathName);
      }
    });
    
    // Extract relationship references from model schema
    var relationships = _.chain(Model.schema.paths).filter(function (path) {
      return path.options && path.options.ref;
    }).map(function (path) {
      // Push relationship paths to omitted object and return a relationship object
      omitted.push(path.path);      
      return { path: path.path, ref: path.options.ref };
    }).value();

    // Instantiate base serialized object
    var serialized = { type: toResourceType(Model.modelName), id: doc._id.toString() };

    // Convert document to plain JS object
    var raw = doc.toObject();
    // Strip away omitted keys from raw object (relationships, id paths, etc.)
    raw = _.omit(raw, omitted);
    // Set the attributes object to the raw JS object
    serialized.attributes = raw;

    // Recursively serialize each relationship object
    _.forEach(relationships, function (rel) {
      var relationship = { links: { self: '/' + serialized.type + '/' + doc.id + '/relationships/' + toResourceType(rel.ref) }};
      var data;

      // Check if relationship path exists on model and if it's an array with at least 1 member
      if (doc[rel.path] && Array.isArray(doc[rel.path]) && doc[rel.path].length) {
        // Convert array of IDs into an array of resource objects, removing nil objects
        data = _.chain(doc[rel.path]).reject(_.isNil).map(function(id) {
          return toRelationshipObject(rel.ref, id);
        }).value();
      } else if (_.isNil(doc[rel.path]) === false && !Array.isArray(doc[rel.path])) {
        // Single values that are not empty are composed into relationship objects
        data = toRelationshipObject(rel.ref, doc[rel.path]);
      }

      // If valid data, then compose final relationship object and add to serialized model
      if (data) {
        relationship.data = data;
        _.set(serialized, 'relationships.' + rel.path, relationship);
      }
      
    });

    // Create self link and add to top level of serialize dobject
    serialized.links = toLinkObject(Model.modelName, doc._id);

    // Ensure all keys in the serialized object are properly formatted. Return result.
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
    // Check if data is the top level member
    data = data.data ? data.data : data;

    // Check if data is an array and a fully composed object (two keys means it's only a type and id). We only want the id for partial objects
    if (Array.isArray(data) && Object.keys(data[0]).length === 2) {
      return _.map(data, function(item) {
        return item.id;
      });
    } else if (Array.isArray(data)) {
      // Otherwise, call desieralize on each member of the array
      return _.map(data, deserialize);
    }

    // Strip out keys with empty/null values from the object and convert the object keys to camelCase
    var o = _.omitBy(keysToCamel(data), _.isNil);
    var relationships = {};
    var deserialized = {};

    // do the same with relationships and attribute objects
    o.relationships = _.omitBy(o.relationships, _.isNil);
    o.attributes = _.omitBy(o.attributes, _.isNil);

    // convert each member of relationships into either an ObjectID or an array of ObjectIDs, then add to the relationships object for later merging.
    _.forEach(o.relationships, function(value, modelPath) {
      var data = _.get(value, 'data');
      relationships[modelPath] = _.isArray(data) ? _.map(value.data, 'id') : _.get(data, 'id');
    });

    // If an attribute property is present, assign to the final deserialized object
    if (o.attributes) {
      Object.assign(deserialized, o.attributes);
    }

    // If an id is present, add to the top level of the final deserialized object
    if (o.id) {
      deserialized.id = o.id;
    }

    // If any ObjectIDs were added to the relationships object, assign each key to the top level deserialized object
    if (Object.keys(relationships).length) {
      Object.assign(deserialized, relationships);
    }

    // Return final deserialized object
    return deserialized;
  };

  /**
   * Recursively removes keys containing null/undefined values from an object
   * @param {Object} obj - A JavaScript object
   * @returns {Object} A copy of the object omitting all keys with null/undefined values
   */
  var stripNullValues = function(obj) {
    return _.omitBy(obj, function(val) {
      if (_.isObject(val)) {
        return stripNullValues(val);
      } else {
        return _.isNil(val);
      }      
    });
  };

  /**
   * Parses complex queries and composes a mongodb-compliant query object form them
   * @param {object} query - The instance of req.query to parse
   * @returns {object} q - A query object in the format mongoose expects
   */
  var digestQuery = function(query) {    
    var q = {};
    var f = 'filter[simple]';
    var keys = _.keys(query).filter(function(key) {
      return _.startsWith(key, f);
    });
    var _parseKey = function(key) {
      var o = {};
      var arr = key.split('][');
      arr.shift();
      arr[arr.length - 1] = arr[arr.length - 1].substring(0, arr[arr.length - 1].length - 1);
      
      if (arr.length === 1) {
        q[arr[0]] = query[key];
      } else if (arr.length === 2) {
        o[arr[1]] = query[key];
        if (q[arr[0]]) {
          Object.assign(q[arr[0]], o);
        } else {
          q[arr[0]] = o;
        }
      }
    };

    keys.forEach(_parseKey);
    return q;
  };

  /**
   * Queries the database, applying req.query to the query and populates the results into res.model
   * @param {object} req
   * @param {object} res
   * @param {function} nexthttps://github.com/joeyfromspace/restful-goose.git
   */
  var querySearch = function(req, res, next) {
    var optionPaths = ['page', 'per_page', 'filter', 'sort', 'include'];
    var query = _.omit(req.query, optionPaths);
    var options = {};
    var sort = req.query.sort ? 
      { sort: _.chain(req.query.sort.split(','))
        .map(function(prop) {
          return (prop.charAt(0) === '-' ? '-' : '') + _.camelCase(prop);
        })
        .join(' ').value() 
      } : {};
    var pagination;
    var extQuery;
    debug('helpers.querySearch invoked');
  
    req.pageNumber = req.query.page ? parseInt(req.query.page, 10) : undefined;
    req.perPage = parseInt(req.query.per_page, 10) || 25;
    pagination = req.pageNumber && !_.isNaN(req.pageNumber) ? { skip: ((req.pageNumber * req.perPage) - req.perPage), limit: req.perPage } : {};

    extQuery = digestQuery(req.query);

    if (req.query.filter) {
      _.assign(query, req.query.filter, extQuery);
    }

    

    Object.assign(options, sort, pagination);
    debug('Query details:');
    debug('================');
    debug('Model: ' + _.get(res, 'rg.Model.modelName'));
    debug('Database: ' + _.get(res, 'rg.Model.db.db.databaseName'));
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
    stripNullValues: stripNullValues,
    toResourceType: toResourceType,
    toRelationshipObject: toRelationshipObject,
    deserialize: deserialize,
    serialize: serialize,
    toModelName: toModelName,
    toLinkObject: toLinkObject,
    digestQuery: digestQuery,
    querySearch: querySearch,
    keysToKebab: keysToKebab,
    keysToCamel: keysToCamel
  };

}());
