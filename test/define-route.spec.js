/* globals describe, before, after, it */
var restfulGoose = require('../index');
var mongoose = require('mongoose');
var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');
var RGTEST = require('./lib/constants');
var _ = require('lodash');
var debug = require('debug')('restful-goose:RouteMap');

var app, RouteMap, routeMap;

chai.use(chaiHttp);
var connection;

after(function (done) {
    connection.db.dropDatabase(function () {
        connection.close(function () {
            done();
        });
    });
});

describe('define route', function() {
  'use strict';
  before(function(done) {
    connection = mongoose.createConnection(RGTEST.MONGO_URI);
    connection.on('open', function() {
      var DefineRouteTestSchema = new mongoose.Schema({
        name: String
      });

      connection.model('DefineRouteTest', DefineRouteTestSchema);
      done();
    });
  });

  after(function(done) {
    connection.db.dropDatabase(function() {
      connection.close(done);
    });
  });

  it('should override route defaults when extending define route class', function(done) {
    app = restfulGoose(connection);
    RouteMap = restfulGoose.RouteMap;
    routeMap = RouteMap.extend({
      beforeModel: function(req, res, next) {
        res.rg.status = 201;
        next();
      },
      afterModel: function(req, res, next) {
        res.model = { cool: true, _id: new mongoose.Types.ObjectId() };
        // Stops serializer crash in test        
        res.model.constructor = connection.model('DefineRouteTest');
        res.model.toObject = function() {
          return _.omit(res.model, ['toObject', 'constructor']);
        };
        next();
      },
      beforeResponse: function(req, res) {
        res.status(res.rg.status).json(res.model);
      }
    });
    app.defineRoute('DefineRouteTest', routeMap);
    chai.request(app)
      .get('/define-route-tests')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        expect(res).to.be.json;
        expect(res.status).to.equal(201);
        expect(res.body.cool).to.equal(true);
        done();
      });
  });

  it('should let you access set properties in later hooks when extending RouteMap base class', function(done) {
    app = restfulGoose(connection);
    RouteMap = restfulGoose.RouteMap;
    app.defineRoute('DefineRouteTest', RouteMap.extend({
      afterModel: function(req, res, next) {
        debug('after model');
        res.model = { amazing: true, robots: 'great', _id: new mongoose.Types.ObjectId() };
        res.model.constructor = connection.model('DefineRouteTest');
        res.model.toObject = function() {
          return _.omit(res.model, ['toObject', 'constructor']);
        };
        next();
      },
      beforeResponse: function(req, res, next) {
        if (res.model && res.model.amazing === true && res.model.robots === 'great') {
          _.set(res, 'data.data.attributes.isokay', true);
        }

        debug('beforeResponse callback');
        next();
      }
    }));
    chai.request(app)
      .get('/define-route-tests')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        expect(res).to.be.json;
        expect(res.status).to.equal(200);
        expect(res.body.data.attributes.isokay).to.equal(true);
        done();
      });
  });
});
