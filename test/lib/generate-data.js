var faker = require('faker');
var async = require('async');
var _ = require('lodash');
var debug = require('debug')('restful-goose:generate-data');

var docs = {};
module.exports = (function() {
  'use strict';
  var count = 10;

  function generateData(model, next) {
    var i = 0;
    debug('Beginning generation for ' + model.modelName + ' on db ' + model.db.db.databaseName);
    docs[model.modelName] = [];
    
    function _create(next) {
      var o = {};
      
      model.schema.eachPath(function(pathName) {
        var path = _.find(model.schema.paths, function(v) {
          return v.path === pathName;
        });
        
        if (!path) {
          debug('No path for ' + pathName);  
        }
        
        
        if (pathName.charAt(0) === '_') {
          return;
        }
        
        switch (path.instance) {
          case 'Date':
            o[pathName] = faker.date.past();  
            break;
          
          case 'String':
            o[pathName] = faker.lorem.word();
            break;
          
          case 'ObjectID':
            if (path.options.ref) {
              o[pathName] = _.sample(docs[path.options.ref])._id;  
            }
            break;
            
          case 'Number':
            o[pathName] = _.random(1, 10);
            break;
          
          case 'Array':
            if (path.options.ref) {
              o[pathName] = _.chain(docs[path.options.ref]).sampleSize(_.random(1, 10)).map('_id').value();
            }
            break;
          
          default:
            break;
        }
      });
      
      debug('creating ' + (i + 1) + ' of ' + count + ' ' + model.modelName);
      model.create(o, function(err, doc) {
        if (err) {
          debug(err);
          return next(err); 
        }
        docs[model.modelName].push(doc);
        i++;
        next();
      });
    }
    
    async.whilst(function() {
      return i < count;
    }, _create, next);
  }

  return function(mongoose, itemCount, done) {
    if (typeof itemCount === 'function') {
      done = itemCount;
    } else if (typeof itemCount === 'number') {
      count = itemCount;
    }
    async.eachSeries(mongoose.models, generateData, done);
  };

}());