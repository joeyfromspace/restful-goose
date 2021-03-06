/* globals describe, before, after, it */
var restfulGoose = require('../index');
var mongoose = require('mongoose');
var chai = require('chai');
var expect = chai.expect;
var chaiHttp = require('chai-http');
var RGTEST = require('./lib/constants');

chai.use(chaiHttp);
var connection,item,app;
var testObj = { name: 'Coolblood1', motto: 'Wow so cool', bio: 'I am from Panama in 1916.' };

after(function (done) {
    connection.db.dropDatabase(function () {
        connection.close(function () {
            done();
        });
    });
});

describe('error handling', function() {
    'use strict';
    before(function(done) {
        connection = mongoose.createConnection(RGTEST.MONGO_URI);
        connection.on('open', function() {
            var ErrorTestSchema = new mongoose.Schema({
                name: { type: String, unique: true, required: true },
                motto: { type: String, required: true },
                bio: { type: String, required: true },
                arbitrary: { type: Number, max: 16 }
            });

            ErrorTestSchema.index({ bio: 1, motto: 1 }, { unique: true });
            connection.model('ErrorTest', ErrorTestSchema);
            done();
        });
    });

    after(function(done) {
        connection.db.dropDatabase(function() {
            connection.close(done);
        });
    });

    it('should create a new item on /error-tests POST', function(done) {
        var data = { data: { type: 'error-tests', attributes: testObj}};
        app = restfulGoose(connection);
        chai.request(app)
            .post('/error-tests')
            .set(RGTEST.HEADER_KEY, RGTEST.HEADER_VALUE)
            .send(JSON.stringify(data))
            .end(function(err, res) {
                expect(res).to.be.json;
                expect(res.status).to.equal(201);
                expect(res.body.data.type).to.equal(data.data.type);
                expect(res.body.data.attributes.name).to.equal(data.data.attributes.name);
                expect(res.body.data.attributes.motto).to.equal(data.data.attributes.motto);
                expect(res.body.data).to.have.property('id');
                done();
            });
    });

    it('should return response error code 409 when sending POST request with a duplicate of a unique value', function(done) {
        var data = { data: { type: 'error-tests', attributes: { name: testObj.name, motto: 'Whatever bro', bio: 'Serial ambivalence'}}};
        chai.request(app)
            .post('/error-tests')
            .set(RGTEST.HEADER_KEY, RGTEST.HEADER_VALUE)
            .send(JSON.stringify(data))
            .end(function(err, res) {
                expect(res).to.be.json;
                expect(res.status).to.equal(409);
                expect(res.body).to.have.property('errors');
                expect(res.body.errors).to.be.a('array');
                expect(res.body.errors.length).to.equal(1);
                expect(res.body.errors[0].title).to.equal('Invalid Attribute');
                expect(res.body.errors[0].source.pointer).to.equal('/data/attributes/name');
                done();
            });
    });

    it('should return response error code 409 when sending POST request with duplicate values of a compound index', function(done) {
        var data = { data: { type: 'error-tests', attributes: { name: 'Cool Story Dude', motto: testObj.motto, bio: testObj.bio }}};
        chai.request(app)
            .post('/error-tests')
            .set(RGTEST.HEADER_KEY, RGTEST.HEADER_VALUE)
            .send(JSON.stringify(data))
            .end(function(err, res) {
                expect(res).to.be.json;
                expect(res.status).to.equal(409);
                expect(res.body).to.have.property('errors');
                expect(res.body.errors).to.be.a('array');
                expect(res.body.errors.length).to.equal(1);
                expect(res.body.errors[0].title).to.equal('Invalid Attribute');
                expect(res.body.errors[0].source.pointer).to.equal('/data/attributes/motto');
                done();
            });
    });

    it('should return a 403 error for causing a validation error on /error-tests/:item POST', function(done) {
      var data = { data: { type: 'error-tests', attributes: { name: 'Cool Story 79', motto: 'Checkooutmymotto', bio: testObj.bio, arbitrary: 17 }}};
      chai.request(app)
        .post('/error-tests')
        .set(RGTEST.HEADER_KEY, RGTEST.HEADER_VALUE)
        .send(JSON.stringify(data))
        .end(function(err, res) {
          var error = res.body.errors[0];
          expect(res.status).to.equal(422);
          expect(res.body).to.have.property('errors');
          expect(res.body.errors).to.be.a('array');
          expect(error.title).to.equal('ValidationError');
          expect(error.source.pointer).to.equal('/data/attributes/arbitrary');
          expect(error.detail).to.equal('Path `arbitrary` (17) is more than maximum allowed value (16).');
          done();
        });
    });

    it('should return 404 not found error on /error-tests/:invalid_id GET', function(done) {
        chai.request(app)
            .get('/error-tests/not-a-real-id')
            .end(function(err, res) {
                expect(res.status).to.equal(404);
                expect(res.body).to.have.property('errors');
                expect(res.body.errors).to.be.a('array');
                expect(res.body.errors.length).to.equal(1);
                expect(res.body.errors[0].title).to.equal('NotFound');
                done();
            });
    });

    it('should return a 500 error when db is disconnected on /error-tests GET', function (done) {
        connection.close(function () { 
            chai.request(app)
                .get('/error-tests')
                .end(function (err, res) {
                    expect(res.status).to.equal(500);
                    done();
                });
        });
    });
});
