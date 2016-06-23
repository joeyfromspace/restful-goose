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
var Model;
var SubModel;

function generateRandomTestData() {
  return { data: { attributes: { name: faker.name.firstName(), rank: faker.random.number() }}};
}

describe('authenticator set GET', function() {
  before(function(done) {
    Model = mongoose.model('Test');
    SubModel = mongoose.model('SubTest');
    app = restfulGoose(mongoose.models, {}, {
      Test: {
        authenticators: {
          get: function (req, res, next) {
            return res.status(401).json({error: 'Unauthorized', code: 'NOPE'});
          }
        },
        subModels: ['SubTest']
      }
    });
    var getRank = function () {
      return Math.floor(Math.random() * (3 - 1)) + 1;
    };

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

  it('should respond with 401 unauthorized on /tests GET', function(done) {
    chai.request(app)
      .get('/tests')
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
  it('should respond with 401 unauthorized on /tests/:item GET', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .get('/tests/' + item.id)
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
  it('should respond with 201 success on /tests POST', function(done) {
    var data = generateRandomTestData();
    chai.request(app)
      .post('/tests')
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data.attributes.name).to.equal(data.data.attributes.name);
        expect(res.body.data.attributes.rank).to.equal(data.data.attributes.rank);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });
  it('should respond with 200 success on /tests/:item PATCH', function(done) {
    var item = _.sample(items);
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .patch('/tests/' + item.id)
      .send({ data: { attributes: data }})
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data.attributes.name).to.equal(data.name);
        expect(res.body.data.attributes.rank).to.equal(data.rank);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });
  it('should respond with 204 success on /:item DELETE', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .delete('/tests/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(204);
        expect(res.body).to.be.empty;
        items.splice(_.findIndex(items, item), 1);
        done();
      });
  });
});

describe('authenticator set POST', function() {
  before(function(done) {
    app = restfulGoose(mongoose.models, {}, { Test: {
      authenticators: {
        post: function (req, res, next) {
          return res.status(401).json({error: 'Unauthorized', code: 'NOPE'});
        }
      }
    }});
    done();
  });

  it('should respond with 200 success on / GET', function(done) {
    chai.request(app)
      .get('/tests/')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        done();
      });
  });
  it('should respond with 200 success on /tests/:item GET', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .get('/tests/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        done();
      });
  });
  it('should respond with 401 unauthorized on /tests POST', function(done) {
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .post('/tests')
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
  it('should respond with 200 success on /:item PATCH', function(done) {
    var item = _.sample(items);
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .patch('/tests/' + item.id)
      .send({ data: { attributes: data }})
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('attributes');
        expect(res.body.data.attributes.name).to.equal(data.name);
        expect(res.body.data.attributes.rank).to.equal(data.rank);
        expect(res.body.data).to.have.property('id');
        done();
      });
  });
  it('should respond with 204 success on /:item DELETE', function(done) {
    var item = _.sample(items);
    chai.request(app)
      .delete('/tests/' + item._id.toString())
      .end(function(err, res) {
        expect(res.status).to.equal(204);
        expect(res.body).to.be.empty;
        items.splice(_.findIndex(items, item), 1);
        done();
      });
  });
});

describe('authenticator set all', function() {
  before(function(done) {
    app = restfulGoose(mongoose.models, {}, { Test: {
      authenticators: {
        all: function (req, res, next) {
          return res.status(401).json({error: 'Unauthorized', code: 'NOPE'});
        }
      }
    }});
    done();
  });
  it('should respond with 401 unauthorized on / GET', function(done) {
    chai.request(app)
      .get('/tests/')
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
      .get('/tests/' + item._id.toString())
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
  it('should respond with 401 unauthorized on /:item PATCH', function(done) {
    var item = _.sample(items);
    var data = { name: faker.name.firstName(), rank: faker.random.number() };
    chai.request(app)
      .patch('/tests/' + item._id.toString())
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
      .post('/tests/')
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
      .delete('/tests/' + item._id.toString())
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