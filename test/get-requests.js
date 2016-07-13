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
var subitems = [];

describe('get requests', function() {
  before(function(done) {
    var getRank = function() {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
    var Model = mongoose.model('Test');
    var SubModel = mongoose.model('SubTest');

    app = restfulGoose(mongoose.models, {}, { Test: {
      subModels: ['SubTest']
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
            return n(err);
          }
          count++;
          items.push(doc);
          n(null, count);
        });
      }, next);
    };

    async.series([removeSubTests, removeTests, createTests, createSubTests], done);
  });

  it('should return a specific object on /tests/:item GET when Content-Type is set to application/vnd.api+json', function(done) {
    var item = _.head(items);
    chai.request(app)
      .get('/tests/' + item._id.toString())
      .set('Content-Type', 'application/vnd.api+json')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data).to.have.property('id');
        expect(res.body.data).to.have.property('type');
        expect(res.body.data).to.have.property('links');
        expect(res.body.data.links).to.have.property('self');
        expect(res.body.data.links.self).to.equal('/tests/' + item._id.toString());
        expect(res.body.data.id).to.equal(item._id.toString());
        expect(res.body.data.attributes).to.have.property('created-at');
        expect((new Date(res.body.data.attributes['created-at'])).getTime()).to.equal(item.createdAt.getTime());
        expect(res.body.data.attributes.name).to.equal(item.name);
        expect(res.body.data.attributes.rank).to.equal(item.rank);
        done();
      });
  });
  
  it('should return a specific object on /tests/:item GET', function(done) {
    var item = _.head(items);
    chai.request(app)
      .get('/tests/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data).to.have.property('id');
        expect(res.body.data).to.have.property('type');
        expect(res.body.data.id).to.equal(item._id.toString());
        expect(res.body.data.attributes.name).to.equal(item.name);
        expect(res.body.data.attributes.rank).to.equal(item.rank);
        done();
      });
  });

  it('should return a list of objects on / GET', function(done) {
    chai.request(app)
      .get('/tests/')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.count).to.equal(testItemCount);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(testItemCount);
        expect(res.body.data[0].id).to.equal(items[0].id);
        done();
      });
  });

  it('should return a list of ten items on /?limit=10 GET', function(done) {
    chai.request(app)
      .get('/tests?limit=10')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.count).to.equal(testItemCount);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(10);
        expect(res.body.data[0].id).to.equal(items[0].id);
        done();
      });
  });

  it('should return only documents with a specified rank on /?rank=x GET', function(done) {
    var rankItems = _.filter(items, { rank: _.head(items).rank });
    chai.request(app)
      .get('/tests?rank=' + rankItems[0].rank)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.count).to.equal(rankItems.length);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(rankItems.length);
        expect(res.body.data[0].id).to.equal(rankItems[0].id);
        done();
      });
  });

  it('should return only 5 documents with a specific rank on /?rank=x&limit=5 GET', function(done) {
    var rankItems = _.filter(items, { rank: _.head(items).rank });
    chai.request(app)
      .get('/tests?rank=' + rankItems[0].rank + '&limit=5')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.count).to.equal(rankItems.length);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(5);
        expect(res.body.data[0].id).to.equal(rankItems[0].id);
        done();
      });
  });

  it('should return 5 documents, skipping the first 5, with a specific rank on /?rank=x&limit=5&skip=5&sort=name GET', function(done) {
    var rankItems = _.chain(items).filter({ rank: _.head(items).rank }).sortBy('name').value();
    chai.request(app)
      .get('/tests?rank=' + rankItems[0].rank + '&limit=5&skip=5&sort=name')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.skip).to.equal(5);
        expect(res.body.meta.count).to.equal(rankItems.length);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(5);
        expect(res.body.data[0].id).to.equal(rankItems[5].id);
        done();
      });
  });

  it('should return documents matching a specific name on /?name=x GET', function(done) {
    var nameSample = _.sample(items).name;
    var nameItems = _.chain(items).filter({ name: nameSample }).value();
    chai.request(app)
      .get('/tests?name=' + nameSample)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.skip).to.equal(0);
        expect(res.body.meta.count).to.equal(nameItems.length);
        expect(res.body.data[0].attributes.name).to.equal(nameItems[0].name);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(nameItems.length);
        done();
      });
  });

  it('should return documents partially matching a specific name on /?name=x GET', function(done) {
    var nameSample = _.sample(items).name.substr(0, 3).toLowerCase();
    var r = new RegExp(nameSample, 'i');
    var nameItems = _.chain(items).filter(function(i) { return r.test(i.name); }).value();
    chai.request(app)
      .get('/tests?name=' + nameSample)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.meta.skip).to.equal(0);
        expect(res.body.meta.count).to.equal(nameItems.length);
        expect(res.body.data[0].attributes.name).to.equal(nameItems[0].name);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(nameItems.length);
        done();
      });
  });

  it('should return documents partially matching a specific name on /?name=x GET (case insensitive)', function(done) {
    var nameSample = _.sample(items).name;
    var nameItems = _.chain(items).filter(function(i) { return i.name.indexOf(nameSample.substr(3).toLowerCase()) >= 0; }).value();
    chai.request(app)
      .get('/tests?name=' + nameSample.substr(3).toUpperCase())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.meta.skip).to.equal(0);
        expect(res.body.meta.count).to.equal(nameItems.length);
        expect(res.body.data[0].attributes.name).to.equal(nameItems[0].name);
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(nameItems.length);
        done();
      });
  });

  it('should return a list of documents sorted in descending order by rank on /?sort=-rank GET', function(done) {
    var itemsByRankDesc = _.chain(items).sortBy('rank').value().reverse();
    chai.request(app)
      .get('/tests?sort=-rank')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('meta');
        expect(res.body).to.have.property('data');
        expect(res.body.meta).to.have.property('limit');
        expect(res.body.meta).to.have.property('skip');
        expect(res.body.meta).to.have.property('count');
        expect(res.body.meta.skip).to.equal(0);
        expect(res.body.meta.count).to.equal(items.length);
        expect(res.body.data.length).to.equal(items.length);
        expect(res.body.data[0].attributes.rank).to.equal(itemsByRankDesc[0].rank);
        expect(res.body.data).to.be.a('array');
        done();
      });
  });
});