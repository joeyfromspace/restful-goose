var express = require('express');
var async = require('async');
var _ = require('lodash');

var RouterFactory = (function() {
  return function() {
    var _search = function(Model, query, callback) {
      function buildSearchObject() {
        var ignoreKeys = ['limit' ,'skip', 'sort'];
        var obj = _.pickBy(query, function(v, k) {
          return ignoreKeys.indexOf(k) === -1;
        });
        _.forOwn(obj, function(value, key) {
          obj[key] = Model.schema.paths.type === String ? new RegExp(value, 'i') : value;
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
            results: results,
            limit: opts.limit,
            skip: opts.skip,
            count: count
          };

          return done(null, resultsObject);
        });

      };

      async.waterfall([getCount, getQuery], callback);
    };
    var _router = express.Router();

    /**
     * @param route (returns id)
     */
    _router.param('item', function(req, res, next) {
      req.__Model.findById(req.params.item).exec(function(err, item) {
        req.params.item = item;
        next();
      });
    });

    /**
     * @GET route
     */
    _router.get('/', function(req, res) {
      _search(req.__Model, req.query || {}, function(err, results) {
        if (err) {
          return res.__onError(req, res, err);
        }

        res.json(results);
      });
    });

    /**
     * @GET One route
     */
    _router.get('/:item', function(req, res) {
      res.json(req.params.item);
    });

    /**
     * @POST route (create)
     */
    _router.post('/', function(req, res) {
      var data = req.body;

      req.__Model.create(data, function(err, doc) {
        if (err) {
          return res.__onError(req, res, err);
        }

        res.json(doc);
      });
    });

    /**
     * @PUT route (update)
     */
    _router.put('/:item', function(req, res) {
      var data = req.body;
      var item = req.params.item;

      async.forEachOf(data, function(value, key, next) {
        item[key] = value;
        next();
      }, function() {
        item.save(function(err, doc) {
          if (err) {
            return res.__onError(req, res, err);
          }

          res.json(doc);
        });
      });
    });

    /**
     * @DELETE route (remove)
     */
    _router.delete('/:item', function(req, res) {
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