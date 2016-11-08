/* globals describe, before, after, it */
var restfulGoose = require('../index');
var mongoose = require('mongoose');
var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');
var _ = require('lodash');

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
      connection.db.dropDatabase(function() {
        connection.model('RequestTest', RequestTestSchema);
        connection.model('SubTest', SubTestSchema);

        routerApp = restfulGoose(connection);
        generateData(connection, count, done);
      });
    });
  });

  after(function(done) {
      connection.db.dropDatabase(function() {
          connection.close(done);
      });
  });

  describe('GET methods', function() {
    var sampleItem;

    before(function getSample(done) {
      connection.model('RequestTest').findOne({ subs: { $exists: true }}, {}, function(err, result) {
        if (!result || !result.subs.length) {
          return getSample(done);
        }
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
              expect(item.relationships.subs).to.have.keys(['data', 'links']);
              expect(item.relationships.subs.data[0]).to.have.all.keys('id', 'type');
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
          expect(res.body.data[0].attributes).to.have.all.keys(['name', 'rank', 'is-cool', 'created-at' ,'updated-at']);
          done();
        });
    });

    it('should return a filtered list of items on /request-tests?isCool=true GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests?isCool=true')
        .end(function(err, res) {
          var coolItems = _.filter(res.body.data, function(item) {
            console.log(item);
            return item.attributes["is-cool"] === true;
          });
          expect(res).to.be.json;
          expect(res.status).to.equal(200);
          expect(res.body).to.be.a('object');
          expect(res.body.data).to.be.a('array');
          expect(res.body.data.length).to.be.at.least(1);
          expect(coolItems.length).to.equal(res.body.data.length);
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
          expect(res.body.data.attributes).to.have.all.keys(['name', 'is-cool', 'rank', 'created-at', 'updated-at']);
          done();
        });
    });

    it('should include sub-tests as compound documents on /request-tests/:item_id?include=subs', function(done) {
      chai.request(routerApp)
        .get('/request-tests/' + sampleItem.id + '?include=subs')
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          expect(res.status).to.equal(200);
          expect(res.body).to.have.property('included');
          expect(res.body.included).to.be.a('array');
          expect(res.body.included.length).to.equal(sampleItem.subs.length);
          expect(_.chain(res.body.included).map('id').sort().value()).to.eql(_.chain(sampleItem.subs).invokeMap('toString').sort().value());
          done();
        });
    });

    it('should retrieve a list of related items at /request-tests/:item_id/relationships/subs GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests/' + sampleItem.id + '/relationships/subs')
        .end(function(err, res) {
          expect(res.status).to.equal(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.be.a('array');
          expect(res.body.data.length).to.equal(sampleItem.subs.length);
          done();
        });
    });

    it('should retrieve an item\'s relationship at /request-tests/:item_id/relationships/subs/:child_id GET', function(done) {
      chai.request(routerApp)
        .get('/request-tests/' + sampleItem.id + '/relationships/subs/' + sampleItem.subs[0])
        .end(function(err, res) {
          expect(res.status).to.equal(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.contain.keys(['id', 'type']);
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
    var sampleId,sampleSub;

    before(function(done) {
      connection.model('SubTest').findOne({}, {}, function(err, item) {
        sampleSub = item;
        done();
      });
    });

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
          sampleId = res.body.data.id;
          done();
        });
    });

    it('should create a new relationship on /request-tests/:item_id/relationships/subs POST', function(done) {
      chai.request(routerApp)
        .post('/request-tests/' + sampleId + '/relationships/subs')
        .set('Content-Type', 'application/vnd.api+json')
        .send(JSON.stringify({ data: { type: 'sub-tests', id: sampleSub.id }}))
        .end(function(err, res) {
          expect(res.status).to.equal(202);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body.data).to.be.a('array');
          expect(res.body.data[0]).to.contain.keys(['id', 'type']);
          expect(res.body.data[0].id).to.equal(sampleSub.id);
          done();
        });
    });
  });

  describe('delete requests', function() {
    var sampleItem,sublength;

    before(function(done) {
      connection.model('RequestTest').findOne({ subs: { $exists: true }}, {}, function(err, item) {
        sampleItem = item;
        sublength = item.subs.length;
        done();
      });
    });

    it('should delete a relationship on /request-tests/:item_id/relationships/subs/:child_id DELETE', function(done) {
      chai.request(routerApp)
        .delete('/request-tests/' + sampleItem.id + '/relationships/subs/' + sampleItem.subs[0])
        .end(function(err, res) {
          expect(res.status).to.equal(202);
          expect(res.body.data.length).to.equal(sublength - 1);
          done();
        });
    });

    it('should only delete a specified relationship on /request-tests/:item_id/relationships/subs DELETE', function(done) {
      var len = sampleItem.subs.length - 1;
      chai.request(routerApp)
        .delete('/request-tests/' + sampleItem.id + '/relationships/subs')
        .send({ data: [ { type: 'sub-tests', id: sampleItem.subs[1] }]})
        .set('Content-Type', 'application/vnd.api+json')
        .end(function(err, res) {
          expect(res.status).to.equal(202);
          expect(res.body.data.length).to.equal(len - 1);
          done();
        });
    });

    it('should completely delete a relationship on /request-tests/:item_id/relationships/subs DELETE', function(done) {
      chai.request(routerApp)
        .delete('/request-tests/' + sampleItem.id + '/relationships/subs')
        .end(function(err, res) {
          expect(res.status).to.equal(202);
          expect(res.body.data).to.deep.equal([]);
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
    var sampleItem,sampleSub;

    before(function(done) {
      connection.model('RequestTest').findOne({}, {}, function(err, item) {
        sampleItem = item;
        connection.model('SubTest').findOne({ _id: { $nin: sampleItem.subs }}, {}, function(err, subItem) {
          sampleSub = subItem;
          done();
        });
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

    it('should update a relationship on an object on /request-tests/:item_id/relationships/subs PATCH', function(done) {
      chai.request(routerApp)
        .patch('/request-tests/' + sampleItem.id + '/relationships/subs')
        .set('Content-Type', 'application/vnd.api+json')
        .send(JSON.stringify({ data: [ { type: 'sub-tests', id: sampleSub.id } ] }))
        .end(function(err, res) {
          expect(res.status).to.equal(200);
          expect(res).to.be.json;
          expect(res.body.data).to.be.a('array');
          expect(res.body.data.length).to.equal(1);
          expect(res.body.data[0].id).to.equal(sampleSub.id);
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
