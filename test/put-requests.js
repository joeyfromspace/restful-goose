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

describe('put requests', function() {
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

  it('should update an existing item on /:item PUT', function(done) {
    var item = _.sample(items);
    var update = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .put('/' + item._id.toString())
      .send(update)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body.name).to.equal(update.name);
        expect(res.body.rank).to.equal(update.rank);
        expect(res.body._id).to.equal(item._id.toString());
        done();
      });
  });

});