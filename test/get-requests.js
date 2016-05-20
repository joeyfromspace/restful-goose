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

var testItemCount = 100;
var items = [];

describe('get requests', function() {
  before(function(done) {
    var getRank = function() {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
    var Model = mongoose.model('Test');
    var count = 0;
    app = restfulGoose(Model);

    mongoose.model('Test').remove({}, function() {
      async.whilst(function() {
        return count < testItemCount;
      }, function(next) {
        var data = {
          name: faker.name.firstName(),
          rank: getRank()
        };
        Model.create(data, function(err, doc) {
          count++;
          items.push(doc);
          next(null, count);
        });
      }, done);
    });
  });

  it('should return a specific object on /:item GET', function(done) {
    var item = _.head(items);
    chai.request(app)
      .get('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body._id).to.equal(item._id.toString());
        expect(res.body.name).to.equal(item.name);
        expect(res.body.rank).to.equal(item.rank);
        done();
      });
  });

  it('should return a list of objects on / GET', function(done) {
    chai.request(app)
      .get('/')
      .end(function(err, res) {
        if (err) {
          throw new Error(err);
        }
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.count).to.equal(testItemCount);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(testItemCount);
        expect(res.body.results[0]._id).to.equal(items[0]._id.toString());
        done();
      });
  });

  it('should return a list of ten items on /?limit=10 GET', function(done) {
    chai.request(app)
      .get('/?limit=10')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.count).to.equal(testItemCount);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(10);
        expect(res.body.results[0]._id).to.equal(items[0]._id.toString());
        done();
      });
  });

  it('should return only documents with a specified rank on /?rank=x GET', function(done) {
    var rankItems = _.filter(items, { rank: _.head(items).rank });
    chai.request(app)
      .get('/?rank=' + rankItems[0].rank)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.count).to.equal(rankItems.length);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(rankItems.length);
        expect(res.body.results[0]._id).to.equal(rankItems[0]._id.toString());
        done();
      });
  });

  it('should return only 5 documents with a specific rank on /?rank=x&limit=5 GET', function(done) {
    var rankItems = _.filter(items, { rank: _.head(items).rank });
    chai.request(app)
      .get('/?rank=' + rankItems[0].rank + '&limit=5')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.count).to.equal(rankItems.length);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(5);
        expect(res.body.results[0]._id).to.equal(rankItems[0]._id.toString());
        done();
      });
  });

  it('should return 5 documents, skipping the first 5, with a specific rank on /?rank=x&limit=5&skip=5&sort=name GET', function(done) {
    var rankItems = _.chain(items).filter({ rank: _.head(items).rank }).sortBy('name').value();
    chai.request(app)
      .get('/?rank=' + rankItems[0].rank + '&limit=5&skip=5&sort=name')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.skip).to.equal(5);
        expect(res.body.count).to.equal(rankItems.length);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(5);
        expect(res.body.results[0]._id).to.equal(rankItems[5]._id.toString());
        done();
      });
  });

  it('should return documents matching a specific name on /?name=x GET', function(done) {
    var nameItems = _.chain(items).filter({ name: _.sample(items).name }).value();
    chai.request(app)
      .get('/?name=' + nameItems[0].name)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.skip).to.equal(0);
        expect(res.body.count).to.equal(nameItems.length);
        expect(res.body.results[0].name).to.equal(nameItems[0].name);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(nameItems.length);
        done();
      });
  });

  it('should return a list of documents sorted in descending order by rank on /?sort=-rank GET', function(done) {
    var itemsByRankDesc = _.chain(items).sortBy('rank').value().reverse();
    chai.request(app)
      .get('/?sort=-rank')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('results');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body).to.have.property('count');
        expect(res.body.skip).to.equal(0);
        expect(res.body.count).to.equal(items.length);
        expect(res.body.results[0].rank).to.equal(itemsByRankDesc[0].rank);
        expect(res.body.results).to.be.a('array');
        expect(res.body.results.length).to.equal(items.length);
        done();
      });
  });
});