/* globals describe, before, after, it */
var assert = require('chai').assert;
var faker = require('faker');
var async = require('async');
var mongoose = require('mongoose');
var testDb = 'mongodb://127.0.0.1:27017/test';
var restfulGoose = require('../index');
var _ = require('lodash');

var createTestObjects = 10;
var testDocs = [];

var connectDb = function(callback) {
  'use strict';
  var connection = mongoose.connect(testDb);
  mongoose.connection.on('connected', function(err) {
    if (err) {
      throw new Error(err);
    }

    connection.connection.db.dropDatabase(callback);
  });
};

var createTestModel = function(callback) {
  'use strict';
  var schema = new mongoose.Schema({
    name: String,
    rank: Number,
    uniquePath: { type: Number, unique: true, default: function() {
      return _.random(1, 900000); 
    }},
    needsEnum: { type: String, enum: ['a', 'b', 'c']},
    createdAt: { type: Date, default: Date.now }
  });
  var subschema = new mongoose.Schema({
    name: String,
    cool: Number,
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' }
  });
  var compoundschema = new mongoose.Schema({
    name: { type: String, required: true },
    motto: { type: String, required: true }
  });

  compoundschema.index({ name: 1, motto: 1 }, { unique: true });

  mongoose.model('CompoundTest', compoundschema);
  mongoose.model('Test', schema);
  mongoose.model('SubTest', subschema);

  return callback();
};

var createTestData = function(callback) {
  'use strict';
  var SubModel = mongoose.model('SubTest');
  var Model = mongoose.model('Test');
  var count = 0;
  var _create = function(next) {
    Model.create({ name: faker.name.firstName(), rank: faker.random.number(), uniquePath: _.random(1, 600000) + count }, function(err, doc) {
      count++;
      testDocs.push(doc);
      SubModel.create({name: faker.name.firstName(), cool: faker.random.number(), test: doc.id}, function (err) {
        return next(err, count);
      });
    });
  };

  async.whilst(function() {
    return count < createTestObjects;
  }, _create, callback);
};

before(function(done) {
  'use strict';
  async.series([connectDb, createTestModel, createTestData], done);
});

after(function(done) {
  'use strict';
  mongoose.connection.close(done);
});


describe('constructor tests', function() {
  'use strict';
  it('should create an app for the test model', function(done) {
    var app = restfulGoose(mongoose);
    assert.isOk(app);
    done();
  });
  it('should listen for connections on specified port', function(done) {
    var app = restfulGoose(mongoose);

    app.listen(3000, function(err) {
      assert.isNotOk(err);
      done();
    });
  });
});