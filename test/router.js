/* globals describe, before, after, it */
var restfulGoose = require('../index');
var mongoose = require('mongoose');
var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');

chai.use(chaiHttp);

var routerApp;
var count = 10;
var RequestTestSchema = require('./lib/requesttest-schema');
var SubTestSchema = require('./lib/subtest-schema');
var generateData = require('./lib/generate-data');
var connection;

describe('router', function() {
  'use strict';
  before(function(done) {
    connection = mongoose.createConnection('mongodb://localhost:27017/restful-goose-router-test');
    connection.on('open', function() {
      connection.model('RequestTest', RequestTestSchema);
      connection.model('SubTest', SubTestSchema);

      routerApp = restfulGoose(connection);
      generateData(connection, count, done);
    });
  });
  
  describe('GET methods', function() {
    var sampleItem;
    
    before(function(done) {
      connection.model('RequestTest').findOne({ subs: { $size: 1 }}, {}, function(err, result) {
        sampleItem = result;
        done();
      });
    });
    
    it('should retrieve a list of RequestTest objects on /request-tests GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests')
        .end(function(err, res) {
          res.body.data.forEach(function(item) {
            if (item.relationships) {
              expect(item.relationships).to.have.property('subs');
              expect(item.relationships.subs[0]).to.have.all.keys(['id', 'type', 'link']);
            }
          });
          expect(res).to.be.json;
          expect(res.status).to.equal(200);
          expect(res.body).to.be.a('object');
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.be.a('array');
          expect(res.body.data.length).to.equal(count);
          expect(res.body.data[0]).to.contain.keys(['id', 'type', 'attributes', 'links']);
          expect(res.body.data[0]).to.have.property('type', 'request-tests');
          expect(res.body.data[0].attributes).to.be.a('object');
          expect(res.body.data[0].attributes).to.not.have.property('subs');
          expect(res.body.data[0].attributes).to.have.all.keys(['name', 'created-at' ,'updated-at']);
          done();
        });
    });

    it('should retrieve a single item on /request-tests/:item_id GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests/' + sampleItem.id)
        .end(function(err, res) {
          expect(res).to.be.json;
          expect(res.status).to.equal(200);
          expect(res.body).to.be.a('object');
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.contain.keys(['id', 'type', 'attributes']);
          expect(res.body.data.type).to.equal('request-tests');
          expect(res.body.data.attributes).to.have.all.keys(['name', 'created-at', 'updated-at']);
          done();
        });
    });
    
    it('should retrieve an item\'s relationship at /request-tests/:item_id/relationships/sub-tests/:child_id', function(done) {
      chai.request(routerApp)
        .get('/request-tests/' + sampleItem.id + '/relationships/sub-tests/' + sampleItem.subs[0])
        .end(function(err, res) {
          expect(res.status).to.equal(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.contain.keys(['id', 'type', 'attributes']);
          done();
        });
    });
    
  });
  
  describe('pagination', function() {
    var page1Ids;
    before(function(done) {
      var count = 50;
      generateData(connection, count, done);
    });
    
    it('should return only the first 10 results on /request-tests?page=1&per_page=10 GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests?page=1&per_page=10')
        .end(function(err,res) {
          expect(res.body).to.be.a('object');
          expect(res.body.data).to.be.a('array');
          expect(res.body.data.length).to.equal(10);
          page1Ids = res.body.data.map(function(item) {
            return item.id;
          });
          done();
        });
    });
    
    it('should return the second 10 results on /request-tests?page=2&per_page=10 GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests?page=2&per_page=10')
        .end(function(err, res) {
          expect(res.body.data.length).to.equal(10);
          expect(res.body.data[0].id).to.not.equal(page1Ids[0].id);
          expect(res.body.data[9].id).to.not.equal(page1Ids[9].id);
          done();
        });
    });
    
    it('paginated requests should have pagination data included in the links object on /request-tests?page=1 GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests?page=1')
        .end(function(err, res) {
          expect(res.body.links).to.contain.keys('first', 'last', 'prev', 'next');
          expect(res.body.links.first).to.equal('/request-tests?page=1');
          expect(res.body.links.prev).to.equal(null);
          expect(res.body.links.next).to.equal('/request-tests?page=2');
          expect(res.body.links.last).to.equal('/request-tests?page=3');
          done();
        });
    });
  });
  
  describe('post requests', function() {
    it('should create a new object on /request-tests POST', function(done) {
      chai.request(routerApp)
        .post('/request-tests')
        .set('Content-Type', 'application/vnd.api+json')
        .send(JSON.stringify({ data: { attributes: { name: 'Bob Loblaw' }}}))
        .end(function(err, res) {
          expect(res.status).to.equal(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body.data).to.contain.keys(['id', 'attributes', 'type']);
          expect(res.body.data.attributes.name).to.equal('Bob Loblaw');
          done();
        });
    });  
  });
  
  describe('delete requests', function() {
    var sampleItem;
    
    before(function(done) {
      connection.model('RequestTest').findOne({}, {}, function(err, item) {
        sampleItem = item;
        done();
      });  
    });
    
    it('should delete an item on /request-tests/:item_id DELETE', function(done) {
      chai.request(routerApp)
        .delete('/request-tests/' + sampleItem.id)
        .end(function(err, res) {
          expect(res.status).to.equal(204);
          expect(res.body).to.not.contain.property('data');
          done();
        });
    });
  });
  
  describe('patch requests', function() {
    var sampleItem;
    
    before(function(done) {
      connection.model('RequestTest').findOne({}, {}, function(err, item) {
        sampleItem = item;
        done();
      });
    });
    
    it('should update the name attribute on an object on /request-tests/:item_id PATCH', function(done) {
      chai.request(routerApp)
        .patch('/request-tests/' + sampleItem.id)
        .set('Content-Type', 'application/vnd.api+json')
        .send(JSON.stringify({ data: { attributes: { name: 'New Name' }}}))
        .end(function(err, res) {
          expect(res.status).to.equal(200);
          expect(res).to.be.json;
          expect(res.body.data.attributes.name).to.equal('New Name');
          done();
        });
    });
  });
  
  
  after(function(done) {
    connection.db.dropDatabase(function() {
      connection.close(done);
    });
  });
});