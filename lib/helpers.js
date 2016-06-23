var _ = require('lodash');
var pluralize = require('pluralize');

module.exports = (function() {

  /**
   *
   * @param {mongoose.document} doc - Turns a model into a legal JSON API representation
   */
  function toJSONAPIObject(doc) {
    var createRelationship = function(relationship, path) {
      var relPath = _.kebabCase(path).toLowerCase();
      var o = {
        links: { self: '/' + toResourceType(doc.constructor.modelName) + '/' + doc._id.toString() + '/relationships/' + relPath }
      };
      var r = function(id) {
        if (typeof id === 'object' && id._id) {
          id = id._id.toString();
        }

        return {
          type: toResourceType(relationship.options.ref),
          id: id
        };
      };

      if (Array.isArray(doc[path]) === false) {
        o.data = r(doc[path]);
      } else {
        o.data = _.map(doc[path], r);
      }

      return o;
    };
    var omittedPaths = [ 'id', '_id', '__v' ];
    var resourceType = toResourceType(doc.constructor.modelName);
    var obj,relationships,attrs;

    var refs = _.pickBy(doc.schema.paths, function(p) {
      return p.options && p.options.ref;
    });

    relationships = _.chain(refs)
      .pickBy(function(p, k) {
        return doc[k] && (Array.isArray(doc[k]) ? doc[k].length > 0 : true);
      })
      .mapValues(createRelationship)
      .mapKeys(function(v, k) {
        return _.kebabCase(k).toLowerCase();
      }).value();

    omittedPaths = _.concat(omittedPaths, Object.keys(refs));
    attrs = _.mapKeys(_.omit(doc.toObject({ virtuals: true }), omittedPaths), function(v,k) {
      return _.kebabCase(k).toLowerCase();
    });

    obj = Object.assign({}, { links: { self: '/' + resourceType + '/' + doc._id.toString() }, id: doc._id.toString(), type: resourceType, attributes: attrs });
    
    if (Object.keys(relationships).length > 0) {
      Object.assign(obj, { relationships: relationships });
    }
    return obj;
  }

  /**
   * Turns a JSON API resource type string (e.g. people) into a mongoose-friendly model name (e.g. Person)
   * @param {string} resourceType - Returns a JSON API resource name as a Mongoose Model string
   * @returns {string} - The Mongoose Model
   */
  function toModelName(resourceType) {
    return pluralize(resourceType.charAt(0).toUpperCase() + _.camelCase(resourceType).substr(1), 1);
  }

  /**
   * Turns a Mongoose model name (e.g. Person) into a JSON API resource type (e.g. people)
   * @param {string} modelName - The name of the model to convert
   * @param {boolean} [isSingular] - Set to true if the returned resource type should be singular. Otherwise returns plural.
   * @returns {string} - A JSON API resource type
   */
  function toResourceType(modelName, isSingular) {
    var singleplural = isSingular ? 1 : 2;
    return pluralize(_.kebabCase(modelName), singleplural).toLowerCase();
  }

  /**
   * Pass through middleware for when middleware that does nothing is needed
   * @param {object} req - Request object
   * @param {object} res - Response object
   * @param {function} next - Callback
   * @returns {*}
   */
  function passThroughMiddleware(req, res, next) {
    return next();
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
      var pk = _.camelCase(key);

      if (!rel.data || (Array.isArray(rel.data) && rel.data.length === 0)) {
        return;
      }

      if (Array.isArray(rel.data)) {
        prop[pk] = _.map(rel.data, 'id');
      } else {
        prop[pk] = rel.data.id;
      }
      Object.assign(obj, prop);
    });

    return obj;
  }


  return {
    toModelName: toModelName,
    toResourceType: toResourceType,
    passThroughMiddleware: passThroughMiddleware,
    insertEmbeddedRelationshipsIntoAttributes: insertEmbeddedRelationshipsIntoAttributes,
    toJSONAPIObject: toJSONAPIObject
  };

}());