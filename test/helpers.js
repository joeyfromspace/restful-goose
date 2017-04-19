var helpers = require('../lib/helpers');
var expect = require('chai').expect;
var mongoose = require('mongoose');
var _ = require('lodash');

var connection;
var count = 10;
var RequestTestSchema = require('./lib/requesttest-schema');
var SubTestSchema = require('./lib/subtest-schema');
var generateData = require('./lib/generate-data');

after(function (done) {
    connection.db.dropDatabase(function () {
        connection.close(function () {
            done();
        });
    });
});

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
                expect(pkg.relationships.subs.data[0].id).to.equal(sub._id.toString());
                done();
            });
        });
    });

    it('should not convert embedded objects like createdAt and updatedAt into empty objects', function(done) {
      connection.model('RequestTest').findOne({}, {}, {}, function(err, doc) {
        var s = helpers.serialize(doc);
        //expect(Object.keys(doc.updatedAt).length).to.not.equal(0);
        expect(s.attributes['updated-at'] instanceof Date).to.equal(true);
        done();
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

    it('should properly deserialize an object with empty array for relationship', function(done) {
      connection.model('RequestTest').findOne({}, {}, {}, function(err, doc) {
        doc.subs = [];
        var s = helpers.serialize(doc);
        var d = helpers.deserialize(s);

        expect(d).to.be.a('object');
        expect(d).not.have.property('subs');
        done();
      });
    });

    it('should properly deserialize an object with null for a relationship', function(done) {
      connection.model('SubTest').findOne({}, {}, {}, function(err, doc) {
        doc.set('parent', null);
        var s = helpers.serialize(doc);
        _.set(s, 'relationships.parent', null);
        var d = helpers.deserialize(s);

        expect(s.parent).to.be.undefined;
        expect(d).to.be.a('object');
        expect(d).not.have.property('parent');
        done();
      });
    });

    it('should properly deserialize an object with a one-to-one relationship', function(done) {
      connection.model('SubTest').findOne({ parent: { $exists: true }}, {}, {}, function(err, doc) {
        var s = helpers.serialize(doc);
        var d = helpers.deserialize(s);

        expect(d).to.be.a('object');
        expect(d).not.have.property('attributes');
        expect(d).not.have.property('relationships');
        expect(d).to.have.property('name', doc.name);
        expect(d.parent).to.be.a('string');
        expect(d.parent).to.equal(doc.parent.toString());
        done();
      });
    });
});

describe('helper.digestQuery()', function() {
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

    it('should return a properly formatted query object on helper.digestQuery(query)', function(done) {
        var exampleQuery = { 'filter[simple][rank][$lte]': 7 };
        var q = helpers.digestQuery(exampleQuery);

        expect(q).to.be.a('object');
        expect(q).to.have.property('rank');
        expect(q.rank).to.have.property('$lte');
        expect(q.rank.$lte).to.be.a('number');

        connection.model('RequestTest').find(q, function(err, items) {
            if (err) {
                throw err;
            }

            expect(items.length).to.be.greaterThan(0);
            expect(items.length).to.be.lessThan(count);
            for (var i = 0; i < items.length; i++) {
                expect(items[i].rank).to.be.lessThan(8);
            }
            done();
        });
    });

    it('should return a properly formatted query object on helper.digestQuery(query) when more than one filter is present', function(done) {
        var exampleQuery = { 'filter[simple][rank][$lte]': 8, 'filter[simple][rank][$gte]': 2, 'sort': '-createdAt' };
        var q = helpers.digestQuery(exampleQuery);

        expect(q).to.be.a('object');
        expect(q).to.have.property('rank');
        expect(q.rank).to.have.property('$lte', 8);
        expect(q.rank).to.have.property('$gte', 2);
        expect(q).to.not.have.property('sort');

        connection.model('RequestTest').find(q, function(err, items) {
            if (err) {
                throw err;
            }

            expect(items.length).to.be.greaterThan(0);
            expect(items.length).to.be.lessThan(count);
            for (var i = 0; i < items.length; i++) {
                expect(items[i].rank).to.be.lessThan(9);
                expect(items[i].rank).to.be.greaterThan(1);
            }
            done();
        });
    });

    
});