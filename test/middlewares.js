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

describe('middlewares GET', function() {
  before(function(done) {
    Model = mongoose.model('Test');
    SubModel = mongoose.model('SubTest');
    app = restfulGoose(Model, {
      middlewares: {
        get: function (req, res, next) {
          res.set('middleware-called', 'true');
          return next();
        }
      }
    });
    
    done();
  });

  it('should have custom header Middleware-Called with value of TRUE on /tests GET', function(done) {
    chai.request(app)
      .get('/tests')
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res).to.be.json;
        expect(res).to.have.header('middleware-called','true');
        done();
      });
  });
  it('should not have Middleware-Called with value of true on /tests POST', function(done) {
    var data = generateRandomTestData();
    chai.request(app)
      .post('/tests')
      .send(data)
      .end(function(err, res) {
        expect(res.status).to.equal(201);
        expect(res).to.be.json;
        expect(res).not.to.have.header('Middleware-Called', 'TRUE');
        done();
      });
  });
});