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
var subitems = [];
var testItemCount = 10;

describe('sub models', function() {
  before(function(done) {
    var getRank = function() {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
    var Model = mongoose.model('Test');
    var SubModel = mongoose.model('SubTest');
    app = restfulGoose(mongoose.models, {}, { Test: {
      subModels: [ 'SubTest' ]
    }});

    var removeSubTests = function(next) {
      mongoose.model('SubTest').remove({}, next);
    };

    var removeTests = function(next) {
      mongoose.model('Test').remove({}, next);
    };

    var createSubTests = function(next) {
      var count = 0;
      async.whilst(function () {
        return count < testItemCount;
      }, function (n) {
        var data = {
          name: faker.name.firstName(),
          cool: getRank(),
          test: _.sample(items).id
        };
        SubModel.create(data, function (err, doc) {
          count++;
          subitems.push(doc);
          n(null, count);
        });
      }, next);
    };

    var createTests = function(next) {
      var count = 0;
      async.whilst(function () {
        return count < testItemCount;
      }, function (n) {
        var data = {
          name: faker.name.firstName(),
          rank: getRank()
        };
        Model.create(data, function (err, doc) {
          if (err) {
            console.error(err);
          }
          count++;
          items.push(doc);
          n(null, count);
        });
      }, next);
    };

    async.series([removeSubTests, removeTests, createTests, createSubTests], done);
  });

  it('should return a list of sub-items associated with a parent item on /tests/:parent/relationships/sub-tests GET', function(done) {
    var subSample = _.sample(subitems);
    var parent = _.find(items, function(p) {
      return p._id.equals(subSample.test);
    });
    var subs = _.filter(subitems, function(i) {
      return parent._id.equals(i.test);
    });
    chai.request(app)
      .get('/tests/' + parent.id + '/relationships/sub-tests')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body).to.have.property('meta');
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(subs.length);
        expect(res.body.data.length).to.be.at.least(1);
        expect(res.body.data[0]).have.property('relationships');
        expect(res.body.data[0]).to.have.property('attributes');
        expect(res.body.data[0].relationships).have.property('test');
        expect(res.body.data[0].relationships.test).have.property('data');
        expect(res.body.data[0].relationships.test.data.id).to.equal(parent.id);
        done();
      });
  });

  it('should return a specific sub-item associated with a parent item on /tests/:parent/relationships/sub-tests/:sub-item GET', function(done) {
    var subSample = _.sample(subitems);
    chai.request(app)
      .get('/tests/' + subSample.test.toString() + '/relationships/sub-tests/' + subSample.id)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data.id).to.equal(subSample.id);
        done();
      });
  });

  it('should create a new sub-item on /tests/:parent/relationships/sub-tests POST', function(done) {
    var data = { name: faker.name.firstName(), cool: faker.random.number() };
    var parent = _.sample(items);
    chai.request(app)
      .post('/tests/' + parent.id + '/relationships/sub-tests')
      .send({ data: { attributes: data }})
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('relationships');
        expect(res.body.data.relationships).to.have.property('test');
        expect(res.body.data.relationships.test).to.have.property('data');
        expect(res.body.data.relationships.test.data.id).to.equal(parent.id);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });

  it('should update a sub-item on /tests/:parent/relationships/sub-tests/:sub-item PATCH', function(done) {
    var data = { name: faker.name.firstName(), cool: faker.random.number() };
    var subSample = _.sample(subitems);
    var parent = _.find(items, function(p) {
      return p._id.equals(subSample.test);
    });
    chai.request(app)
      .patch('/tests/' + parent.id + '/relationships/sub-tests/' + subSample.id)
      .send({ data: { attributes: data }})
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('relationships');
        expect(res.body.data.relationships).to.have.property('test');
        expect(res.body.data.relationships.test).to.have.property('data');
        expect(res.body.data.relationships.test.data.id).to.equal(parent.id);
        expect(res.body.data).to.have.property('id');
        expect(res.body.data.attributes.name).to.equal(data.name);
        expect(res.body.data.attributes.cool).to.equal(data.cool);
        done();
      });
  });
  
  it('should create a new sub-item on /sub-tests POST', function(done) {
    var parent = _.sample(items);
    var request = { data: { attributes: { name: faker.name.firstName(), cool: faker.random.number() }, relationships: { test: { data: { type: 'tests', id: parent.id }} }}};
    chai.request(app)
      .post('/sub-tests')
      .send(request)
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('relationships');
        expect(res.body.data.relationships.test.data.id).to.equal(parent.id);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });
});