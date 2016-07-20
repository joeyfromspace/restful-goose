var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');
var mongoose = require('mongoose');
var restfulGoose = require('../index');
var faker = require('faker');
var async = require('async');
var _ = require('lodash');

chai.use(chaiHttp);

var app;
var item;

describe('error responses', function() {
  before(function(done) {
    app = restfulGoose(mongoose.models);
    mongoose.model('Test').findOne({}, function(err, testItem) {
      item = testItem;
      done();
    });
  });

  it('should return a valid error on /tests POST', function(done) {
    var data = { data: { type: 'tests', attributes: { name: 'Whatever man', rank: 84938493, needsEnum: 'd' }}};
    chai.request(app)
      .post('/tests')
      .set('Content-Type', 'application/vnd.api+json')
      .send(JSON.stringify(data))
      .end(function(err, res) {
        expect(res.status).to.equal(422);
        expect(res).to.be.json;
        expect(res.body).to.have.property('errors');
        expect(res.body.errors.length).to.equal(1);
        expect(res.body.errors[0].title).to.equal('Invalid Attribute'),
        expect(res.body.errors[0].source.pointer).to.equal('/data/attributes/needs-enum');
        done();
      });
  });

  it('should return a duplicate key error on /tests POST', function(done) {
    var data = { data: { type: 'tests', attributes: { name: 'Whatever man', rank: 333, uniquePath: item.uniquePath, needsEnum: 'a' }}};
    chai.request(app)
      .post('/tests')
      .set('Content-Type', 'application/vnd.api+json')
      .send(JSON.stringify(data))
      .end(function(err, res) {
        expect(res.status).to.equal(409);
        expect(res).to.be.json;
        expect(res.body).to.have.property('errors');
        expect(res.body.errors).to.be.a('array');
        done();
      });
  });
});