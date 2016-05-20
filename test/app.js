var assert = require('chai').assert;
var faker = require('faker');
var async = require('async');
var mongoose = require('mongoose');
var testDb = 'mongodb://127.0.0.1:27017/test';
var restfulGoose = require('../index');

var createTestObjects = 10;
var testDocs = [];

var connectDb = function(callback) {
  var connection = mongoose.connect(testDb);
  mongoose.connection.on('connected', function(err) {
    if (err) {
      throw new Error(err);
    }

    connection.connection.db.dropDatabase(callback);
  });
};

var createTestModel = function(callback) {
  var schema = new mongoose.Schema({
    name: String,
    rank: Number
  });
  mongoose.model('Test', schema);

  return callback();
};

var createTestData = function(callback) {
  var Model = mongoose.model('Test');
  var count = 0;
  var _create = function(next) {
    Model.create({ name: faker.name.firstName(), rank: faker.random.number() }, function(err, doc) {
      count++;
      testDocs.push(doc);
      return next(err, count);
    });
  };

  async.whilst(function() {
    return count < createTestObjects;
  }, _create, callback);
};

before(function(done) {
  async.series([connectDb, createTestModel, createTestData], done);
});

after(function(done) {
  mongoose.connection.close(done);
});


describe('constructor tests', function() {
  it('should create an app for the test model', function(done) {
    var Model = mongoose.model('Test');
    var app = restfulGoose(Model);

    assert.isOk(app);
    done();
  });
  it('should listen for connections on specified port', function(done) {
    var Model = mongoose.model('Test');
    var app = restfulGoose(Model);

    app.listen(3000, function(err) {
      assert.isNotOk(err);
      done();
    });
  });
});