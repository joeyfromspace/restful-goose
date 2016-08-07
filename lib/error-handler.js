var _ = require('lodash');
var debug = require('debug')('restful-goose:error-handler');
var errorTypes = require('./errors');

module.exports = function(req, res) {
  'use strict';
  function _parseError(error) {
    debug('_parseError invoked');
    _.find(errorTypes, function(errorType) {
      return errorType === error.message;
    });
    
    return error;
  }
  var errors = _.chain(res.errors).flatten().map(_parseError).value();

  debug('Error handler invoked');
  debug(res.errors);
  res.status = _.head(errors).code;
  res.json({ errors: errors });
};