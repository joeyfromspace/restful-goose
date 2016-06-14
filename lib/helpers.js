var _ = require('lodash');
var pluralize = require('pluralize');

module.exports = (function() {

  /**
   *
   * @param {mongoose.document} doc - Turns a model into a legal JSON API representation
   */
  function toJSONAPIObject(doc, fullLink) {
    var Model = doc.constructor;
    var schemaPaths =  Model.schema ? Model.schema.paths : Model.paths;
    var modelName = Model.modelName;
    var attribs = doc.toObject({ getters: true, versionKey: false, depopulate: true });
    var obj = { id: attribs.id || doc._id.toString(), type: toResourceType(modelName), links: { self: fullLink + '/' + attribs.id } };

    _.forEach(schemaPaths, function(p, name) {
      /* TODO Also populate the links object with related items */
      var rel = {};
      var resourceName = _.kebabCase(name);

      if (!p.options.ref) {
        return;
      }

      // Setup relationship object
      if (Array.isArray(attribs[name])) {
        rel[resourceName] = { links: { self: fullLink + '/' + attribs.id + '/relationships/' + resourceName }, data: _.map(attribs[name], function(rel) {
          return { type: toResourceType(p.options.ref), id: rel };
        })};
      } else {
        rel[resourceName] = { links: { self: fullLink + '/' + attribs.id + '/relationships/' + resourceName }, data: { type: toResourceType(p.options.ref), id: attribs[name] }};
      }

      // Remove original path from attributes object
      delete attribs[name];

      // We don't want to assign the relationship to the object if it's an empty array
      if ((Array.isArray(rel[resourceName].data) === false && !rel[resourceName].data.id) || (Array.isArray(rel[resourceName].data) && rel[resourceName].data.length === 0)) {
        return;
      }

      if (obj.hasOwnProperty('relationships') === false) {
        obj.relationships = {};
      }

      // Finally, assign relationship to object's relationships hash
      Object.assign(obj.relationships, rel);
    });

    // Remove ids from attributes
    delete attribs.id;
    delete attribs._id;

    obj.attributes = _.mapKeys(attribs, function(v, k) {
      return _.kebabCase(k);
    });
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