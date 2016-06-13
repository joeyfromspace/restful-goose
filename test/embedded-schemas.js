var faker = require('faker');
var async = require('async');
var mongoose = require('mongoose');
var restfulGoose = require('../index');
var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');
var _ = require('lodash');

chai.use(chaiHttp);

var items = [];
var testItemCount = 25;
var app;

describe('embedded schema tests', function() {
  before(function (done) {
    var getRank = function () {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };

    var embedTestSubSchema = new mongoose.Schema({
      name: String
    });

    var embedTestParentSchema = new mongoose.Schema({
      name: String,
      createdAt: {type: Date, default: Date.now},
      embeds: {type: [embedTestSubSchema] }
    });

    mongoose.model('EmbeddedTestParent', embedTestParentSchema);

    var EmbedTestParent = mongoose.model('EmbeddedTestParent');
    app = restfulGoose(EmbedTestParent);

    var removeEmbedTests = function (next) {
      mongoose.model('EmbeddedTestParent').remove({}, next);
    };
    
    var createRandomEmbedSubs = function() {
      var r = _.random(1, 99);
      var a = [];
      var i = 0;
      
      while (i < r) {
        i++;
        a.push({ name: faker.name.firstName() });
      }
      
      return a;
    };

    var createEmbedTestParents = function (next) {
      var count = 0;
      async.whilst(function () {
        return count < testItemCount;
      }, function (n) {
        var data = {
          name: faker.name.firstName(),
          embeds: createRandomEmbedSubs()
        };
        EmbedTestParent.create(data, function (err, doc) {
          count++;
          items.push(doc);
          n(null, count);
        });
      }, next);
    };

    async.series([removeEmbedTests, createEmbedTestParents], done);
  });

  it('should return a list of embedded items on /embedded-test-parents/:item/embeds GET', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .get('/embedded-test-parents/' + item.id + '/embeds')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');
        expect(res.body.data.length).to.equal(item.embeds.length);
        done();
      });
  });

  it('should return a specific embedded item on /embedded-test-parents/:item/embeds/:embedded-item GET', function(done) {
    var item = _.sample(items);
    var embedded = _.sample(item.embeds);
    chai.request(app)
      .get('/embedded-test-parents/' + item.id + '/embeds/' + embedded.id)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.id).to.equal(embedded.id);
        done();
      });
  });

  it('should create a new embedded item on /embedded-test-parents/:item/embeds POST', function(done) {
    var o = { data: { attributes: { name: faker.name.firstName() } } };
    var item = _.sample(items);
    chai.request(app)
      .post('/embedded-test-parents/' + item.id + '/embeds')
      .set('Content-Type', 'application/vnd.api+json')
      .send(JSON.stringify(o))
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(_.last(res.body.data.attributes.embeds).name).to.equal(o.data.attributes.name);
        done();
      });
  });

  it('should update an embedded item on /embedded-test-parents/:item/embeds/:embedded-item PATCH', function(done) {
    var item = _.sample(items);
    var embed = _.sample(item.embeds);
    var index = _.findIndex(item.embeds, embed);
    var o = { data: { id: embed.id, type: 'embeds', attributes: { name: faker.name.firstName() } } };
    chai.request(app)
      .patch('/embedded-test-parents/' + item.id + '/embeds/' + embed.id)
      .set('Content-Type', 'application/vnd.api+json')
      .send(JSON.stringify(o))
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.attributes.embeds[index].name).to.equal(o.data.attributes.name);
        done();
      });
  });
});