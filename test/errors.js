var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');
var mongoose = require('mongoose');
var restfulGoose = require('../index');
var faker = require('faker');
var async = require('async');
var _ = require('lodash');

function compoundFactory() {
  return { name: `${faker.name.firstName()} ${faker.name.lastName()}`, motto: faker.hacker.phrase() };
} 

chai.use(chaiHttp);

var app;
var item;
var compoundItems = [];
var COMPOUND_TEST_COUNT = 10;

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
        console.log(_.map(res.body.errors, 'source.pointer').join(', '));
        done();
      });
  });
});

describe('compound index error handling', function() {
  before(function(done) {
    var i = 0;
    var CompoundTest = mongoose.model('CompoundTest');
    async.whilst(function() {      
      return i < COMPOUND_TEST_COUNT;
    }, function(next) {      
      CompoundTest.create(compoundFactory(), function(err, doc) {
        compoundItems.push(doc);
        i++;
        next(err);
      });
    }, done);
  });

  it('should return an error on attepted post of compound item', function(done) {
    var item = _.sample(compoundItems).toObject();
    var data = { data: { id: item._id.toString(), type: 'compound-tests', attributes: _.omit(item, [ 'id', '_id' ])}};
    chai.request(app)
      .post('/compound-tests')
      .send(JSON.stringify(data))
      .set('Content-Type', 'application/vnd.api+json')
      .end(function(err, res) {
        expect(res).to.be.json;
        expect(res.status).to.equal(409);
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('errors');
        expect(res.body.errors).to.be.a('array');
        done();
        console.log(_.map(res.body.errors, 'source.pointer').join(', '));
      });
  });
});