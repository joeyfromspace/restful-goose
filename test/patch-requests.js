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

describe('patch requests', function() {
  before(function (done) {
    var getRank = function () {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
    var Model = mongoose.model('Test');
    var count = 0;
    app = restfulGoose(mongoose.models);

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

  it('should update an existing item on /tests/:item PATCH', function(done) {
    var item = _.sample(items);
    var newTime = item.createdAt.getTime() + 400000;
    var update = { data: { attributes: { name: faker.name.firstName(), rank: faker.random.number(), 'created-at': newTime }}};
    chai.request(app)
      .patch('/tests/' + item.id)
      .send(update)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body.data.attributes.name).to.equal(update.data.attributes.name);
        expect(Math.floor((new Date(res.body.data.attributes["created-at"])).getTime() / 1000)).to.equal(Math.floor((new Date(newTime).getTime() / 1000)));
        expect(res.body.data.attributes.rank).to.equal(update.data.attributes.rank);
        expect(res.body.data.id).to.equal(item.id);
        done();
      });
  });

  it('should update an existing item on /tests/:item PATCH and Content-Type is application/vnd.api+json', function(done) {
    var item = _.sample(items);
    var update = { data: { attributes: { name: faker.name.firstName(), rank: faker.random.number() }}};
    chai.request(app)
      .patch('/tests/' + item.id)
      .set('Content-Type', 'application/vnd.api+json')
      .send(JSON.stringify(update))
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body.data.attributes.name).to.equal(update.data.attributes.name);
        expect(res.body.data.attributes.rank).to.equal(update.data.attributes.rank);
        expect(res.body.data.id).to.equal(item.id);
        done();
      });
  });
});