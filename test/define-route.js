/* globals describe, before, after, it */
var restfulGoose = require('../index');
var mongoose = require('mongoose');
var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');

var app, RouteMap, routeMap;

chai.use(chaiHttp);
var connection;

describe('define route', function() {
  'use strict';
  before(function(done) {
    connection = mongoose.createConnection('mongodb://localhost:27017/restful-goose-define-route-test');
    connection.on('open', function() {
      var DefineRouteTestSchema = new mongoose.Schema({
        name: String
      });

      connection.model('DefineRouteTest', DefineRouteTestSchema);
      done();
    });
  });

  after(function(done) {
    console.log('after hook ' + connection.db.databaseName);
    connection.db.dropDatabase(function() {
      connection.close(done);
    });
  });

  it('should override route defaults when extending define route class', function(done) {
    app = restfulGoose(mongoose);
    RouteMap = restfulGoose.RouteMap;
    routeMap = RouteMap.extend({
      beforeModel: function(req, res) {
        res.status(200).json({ cool: true });
      }
    });
    app.defineRoute('DefineRouteTest', routeMap);
    chai.request(app)
      .get('/define-route-tests')
      .set('Content-Type', 'application/vnd.api+json')
      .end(function(err, res) {
        expect(res).to.be.json;
        expect(res.status).to.equal(200);
        expect(res.body.cool).to.equal(true);
        done();
      });
  });
});