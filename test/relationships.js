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
var relItems = [];
var testItemCount = 25;
var app;

describe('relationship tests', function() {
  before(function(done) {
    var getRank = function() {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
    var relTestSchema = new mongoose.Schema({
      name: String,
      rank: Number,
      createdAt: { type: Date, default: Date.now },
      testTwos: { type: [mongoose.Schema.Types.ObjectId], ref: 'RelTestTwo'}
    });
    
    var relTestTwoSchema = new mongoose.Schema({
      name: String,
      testOne: { type: mongoose.Schema.Types.ObjectId, ref: 'RelTest' },
      createdAt: { type: Date, default: Date.now },
    });
    
    mongoose.model('RelTest', relTestSchema);
    mongoose.model('RelTestTwo', relTestTwoSchema);
    
    var RelTest = mongoose.model('RelTest');
    var RelTestTwo = mongoose.model('RelTestTwo');
    app = restfulGoose(RelTest);

    var removeRelTests = function(next) {
      mongoose.model('RelTest').remove({}, next);
    };

    var removeRelTestTwos = function(next) {
      mongoose.model('RelTestTwo').remove({}, next);
    };

    var createRelTestTwos = function(next) {
      var count = 0;
      async.whilst(function () {
        return count < testItemCount;
      }, function (n) {
        var data = {
          name: faker.name.firstName(),
          testOne: _.sample(items).id
        };
        RelTestTwo.create(data, function (err, doc) {
          count++;
          relItems.push(doc);
          n(null, count);
        });
      }, next);
    };

    var createRelTests = function(next) {
      var count = 0;
      async.whilst(function () {
        return count < testItemCount;
      }, function (n) {
        var data = {
          name: faker.name.firstName(),
          rank: getRank()
        };
        RelTest.create(data, function (err, doc) {
          if (err) {
            console.error(err);
          }
          count++;
          items.push(doc);
          n(null, count);
        });
      }, next);
    };
    
    var populateRelTestRefs = function(next) {
      var hasEmptyTestTwo = false;
      async.map(items, function(item, n) {
        if (hasEmptyTestTwo === false) {
          hasEmptyTestTwo = true;
          return n(null, item);
        }
        
        item.testTwos = _.chain(relItems).sampleSize(_.random(1, relItems.length)).map('_id').value();
        item.save(function(err, newItem) {
          return n(err, newItem);
        });
      }, function(err, results) {
        if (err) {
          console.error(err);
        }
        items = results;
        next(err);
      });
    };

    async.series([removeRelTests, removeRelTestTwos, createRelTests, createRelTestTwos, populateRelTestRefs], done);
  });
  
  it('should not include empty relationships in response on /rel-tests/:item GET', function(done) {
    var emptyItem = _.find(items, function(i) {
      return !i.testTwos || i.testTwos.length === 0;
    });
    chai.request(app)
      .get('/rel-tests/' + emptyItem.id)
      .end(function(err, res) {
        console.log(res.body.data);
        expect(res).to.be.json;
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.not.have.property('relationships');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data.attributes).to.not.have.property('test-twos');
        done();
      });
  });
  
  it('should return relationship objects in response when they exist on /rel-tests/:item GET', function(done) {
    var item = _.find(items, function(i) {
      return i.testTwos && i.testTwos.length > 0;
    });
    chai.request(app)
      .get('/rel-tests/' + item.id)
      .end(function(err, res) {
        expect(res).to.be.json;
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('relationships');
        expect(res.body.data.relationships).to.have.property('test-twos');
        expect(res.body.data.relationships["test-twos"].data).to.be.a('array');
        expect(res.body.data.relationships["test-twos"].data.length).to.equal(item.testTwos.length);
        expect(res.body.data.attributes).to.not.have.property('test-twos');
        done();
      });
  });
});