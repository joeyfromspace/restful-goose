/* globals describe, before, after, it */
var api = require('../index');
var mongoose = require('mongoose');
var connection;

describe('initialization tests', function() {
  'use strict';
  before(function(done) {
    connection = mongoose.createConnection('localhost', 'restful-goose-load-test', 27017);
    connection.on('open', function() {
      var TestSchema = new mongoose.Schema({
          name: String
      });
      connection.model('Test', TestSchema);
      
      done();
    });
  });

  after(function(done) {
    console.log('after hook ' + connection.db.databaseName);
    connection.db.dropDatabase(function() {
      connection.close(done);  
    });
  });
  
  it ('should open the app without throwing an exception', function(done) {
    api(mongoose);
    done();
  });
});