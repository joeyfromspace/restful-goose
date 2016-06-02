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

var items = [];
var testItemCount = 10;

describe('post requests', function() {
  before(function (done) {
    var getRank = function () {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
    var Model = mongoose.model('Test');
    var count = 0;
    app = restfulGoose(Model);

    mongoose.model('Test').remove({}, function () {
      async.whilst(function () {
        return count < testItemCount;
      }, function (next) {
        var data = {
          name: faker.name.firstName(),
          rank: getRank()
        };
        Model.create(data, function (err, doc) {
          count++;
          items.push(doc);
          next(null, count);
        });
      }, done);
    });
  });

  it('should create a new item on / POST', function(done) {
    var data = { data: { attributes: { name: faker.name.firstName(), rank: faker.random.number() }}};
    chai.request(app)
      .post('/tests')
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data.attributes.name).to.equal(data.data.attributes.name);
        expect(res.body.data.attributes.rank).to.equal(data.data.attributes.rank);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });

  it('should create a new item on / POST when Content-Type is set to application/vnd.api+json', function(done) {
    var data = { data: { attributes: { name: faker.name.firstName(), rank: faker.random.number() }}};
    chai.request(app)
      .post('/tests')
      .set('Content-Type', 'application/vnd.api+json')
      .send(JSON.stringify(data))
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data.attributes.name).to.equal(data.data.attributes.name);
        expect(res.body.data.attributes.rank).to.equal(data.data.attributes.rank);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });


});