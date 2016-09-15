var helpers = require('../lib/helpers');
var expect = require('chai').expect;
var mongoose = require('mongoose');

var connection;
var count = 10;
var RequestTestSchema = require('./lib/requesttest-schema');
var SubTestSchema = require('./lib/subtest-schema');
var generateData = require('./lib/generate-data');

describe('helper.serialize()', function() {
    'use strict';

    before(function(done) {
        connection = mongoose.createConnection('mongodb://localhost:27017/restful-goose-router-test');
        connection.on('open', function() {
            connection.model('RequestTest', RequestTestSchema);
            connection.model('SubTest', SubTestSchema);
            generateData(connection, count, done);
        });
    });

    after(function(done) {
        connection.db.dropDatabase(function() {
            connection.close(done);
        });
    });

    it('should take an object and convert it into a json api package', function(done) {
        var RequestTest = connection.model('RequestTest');
        var SubTest = connection.model('SubTest');

        SubTest.findOne({}, {}, {}, function(err, sub) {
            var o = {
                name: 'Cool',
                createdAt: Date.now(),
                rank: 14,
                isCool: true,
                subs: [sub._id]
            };

            RequestTest.create(o, function(err, doc) {
                var pkg = helpers.serialize(doc);
                expect(pkg).to.be.a('object');
                expect(pkg).to.have.property('attributes');
                expect(pkg).to.have.property('relationships');
                expect(pkg.attributes.name).to.equal(o.name);
                expect(pkg.attributes.rank).to.equal(o.rank);
                expect(pkg.relationships.subs[0].data.id).to.equal(sub._id.toString());
                done();
            });
        });
    });
});

describe('helper.deserialize()', function() {
    'use strict';


    before(function(done) {
        connection = mongoose.createConnection('mongodb://localhost:27017/restful-goose-router-test');
        connection.on('open', function() {
            connection.model('RequestTest', RequestTestSchema);
            connection.model('SubTest', SubTestSchema);
            generateData(connection, count, done);
        });
    });

    after(function(done) {
        connection.db.dropDatabase(function() {
            connection.close(done);
        });
    });

    it('should properly deserialize an object and convert it into a model', function(done) {
        connection.model('RequestTest').findOne({}, {}, {}, function(err, doc) {
            var s = helpers.serialize(doc);
            var d = helpers.deserialize(s);

            expect(d).to.be.a('object');
            expect(d).not.have.property('attributes');
            expect(d).not.have.property('relationships');
            expect(d).to.have.property('name', doc.name);
            expect(d).to.have.property('rank', doc.rank);
            expect(d).have.property('subs');
            expect(d.subs).to.be.a('array');
            expect(d.subs.length).to.equal(doc.subs.length);
            done();
        });
    });
});
