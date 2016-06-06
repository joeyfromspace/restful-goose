var async = require('async');
var mongoose = require('mongoose');
var _ = require('lodash');

module.exports = function(Model, query, callback) {
  function buildSearchObject() {
    var ignoreKeys = ['limit' ,'skip', 'sort'];
    var obj = _.pickBy(query, function(v, k) {
      return ignoreKeys.indexOf(k) === -1;
    });
    _.forOwn(obj, function(value, key) {
      obj[key] = Model.schema.paths[key].options.type === String ? { $regex: value, $options: 'i' } : value;
    });

    return obj;
  }
  function buildSortObject() {
    var obj = {};
    var sorts = query.sort.split(',');
    _.forEach(sorts, function(s) {
      if (s.charAt(0) === '-') {
        obj[s.substr(1)] = -1;
      } else {
        obj[s] = 1;
      }
    });

    return obj;
  }
  function buildQueryOptions() {
    var obj = {};
    obj.limit = parseInt(query.limit, 10) || false;
    obj.skip = parseInt(query.skip, 10) || 0;
    obj.sort = query.sort ? buildSortObject() : undefined;

    return obj;
  }
  var opts = query ? buildQueryOptions() : null;
  var search = buildSearchObject();

  var getCount = function(done) {
    Model.where(search).count(done);
  };

  var getQuery = function(count, done) {
    Model.find(search, null, opts, function(err, results) {
      var resultsObject;

      if (err) {
        return done(err);
      }

      resultsObject = {
        data: results,
        meta: {
          limit: opts.limit,
          skip: opts.skip,
          count: count
        }
      };

      return done(null, resultsObject);
    });

  };

  async.waterfall([getCount, getQuery], callback);
};