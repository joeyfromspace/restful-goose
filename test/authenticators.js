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
var Model;

describe('authenticator set GET', function() {
  before(function(done) {
    var count = 0;
    Model = mongoose.model('Test');
    app = restfulGoose(Model, {
      authenticators: {
        get: function (req, res, next) {
          return res.status(401).json({error: 'Unauthorized', code: 'NOPE'});
        }
      }
    });
    var getRank = function () {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };
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

  it('should respond with 401 unauthorized on / GET', function(done) {
    chai.request(app)
      .get('/')
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 401 unauthorized on /:item GET', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .get('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 200 success on / POST', function(done) {
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .post('/')
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body.name).to.equal(data.name);
        expect(res.body.rank).to.equal(data.rank);
        expect(res.body).to.have.property('_id');
        done();
      });
  });
  it('should respond with 200 success on /:item PUT', function(done) {
    var item = _.sample(items);
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .put('/' + item._id.toString())
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body.name).to.equal(data.name);
        expect(res.body.rank).to.equal(data.rank);
        expect(res.body).to.have.property('_id');
        done();
      });
  });
  it('should respond with 200 success on /:item DELETE', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .delete('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.empty;
        items.splice(_.findIndex(items, item), 1);
        done();
      });
  });
});

describe('authenticator set POST', function() {
  before(function(done) {
    Model = mongoose.model('Test');
    app = restfulGoose(Model, {
      authenticators: {
        post: function (req, res, next) {
          return res.status(401).json({error: 'Unauthorized', code: 'NOPE'});
        }
      }
    });
    done();
  });

  it('should respond with 200 success on / GET', function(done) {
    chai.request(app)
      .get('/')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        done();
      });
  });
  it('should respond with 200 success on /:item GET', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .get('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        done();
      });
  });
  it('should respond with 401 unauthorized on / POST', function(done) {
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .post('/')
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 200 success on /:item PUT', function(done) {
    var item = _.sample(items);
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .put('/' + item._id.toString())
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body.name).to.equal(data.name);
        expect(res.body.rank).to.equal(data.rank);
        expect(res.body).to.have.property('_id');
        done();
      });
  });
  it('should respond with 200 success on /:item DELETE', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .delete('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.empty;
        items.splice(_.findIndex(items, item), 1);
        done();
      });
  });
});

describe('authenticator set all', function() {
  before(function(done) {
    app = restfulGoose(Model, {
      authenticators: {
        all: function (req, res, next) {
          return res.status(401).json({error: 'Unauthorized', code: 'NOPE'});
        }
      }
    });
    done();
  });
  it('should respond with 401 unauthorized on / GET', function(done) {
    chai.request(app)
      .get('/')
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 401 unauthorized on /:item GET', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .get('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 401 unauthorized on /:item PUT', function(done) {
    var item = _.sample(items);
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .put('/' + item._id.toString())
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 401 unauthorized on / POST', function(done) {
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .post('/')
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
  it('should respond with 401 unauthorized on /:item DELETE', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .delete('/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(401);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('error');
        expect(res.body).to.have.property('code');
        expect(res.body.code).to.equal('NOPE');
        expect(res.body.error).to.equal('Unauthorized');
        done();
      });
  });
});