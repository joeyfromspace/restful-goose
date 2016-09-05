var crypto = require('crypto');
var _ = require('lodash');
var debug = require('debug')('restful-goose:error-handler');

/**
 * Default error-handling middleware
 * @middleware
 *
 */
module.exports = function(req, res) {
  function getErrCode(errName) {
    switch (errName) {
      case 'BadRequest':
        return 400;

      case 'MongoError':
        return 409;
      
      case 'ValidationError':
        return 422;

      case 'CastError':
        return 409;

      case 'AuthorizationError':
        return 401;

      case 'NotFound':
        return 404;

      default:
        return 500;
    }
  }

  function toJSONErrorObject(error, key) {
    function extractPathFromErrorMessage(mesg) {
      var r = /(?:\$|_)?(?:([a-z]+)_[0-9]_?)+/i;
      var match = mesg.match(r);

      if (match && match.length > 1) {
        return mesg.match(r)[1];
      }

      return match;
    }
    function extractValueFromErrorMessage(mesg) {
      var r = /key:\s{\s:\s((?:\\")?.+(?:\\")?)\s}/i;
      var match = mesg.match(r);

      if (match && match.length > 1) {
        return match[1];
      }
      
      return match;
    }
    var obj = {};
    
    obj.id = crypto.randomBytes(4).toString('hex');
    obj.links = {
      about: ''
    };

    if (err.name && err.name === 'ValidationError') {
      obj.status = res.status;
      obj.detail = error.message;
      obj.title = 'Invalid Attribute';
      obj.source = { pointer: '/data/attributes/' + _.kebabCase(key).toLowerCase() };
    } else if (error.name === 'MongoError' && error.code === 11000) {
      var errorPath = extractPathFromErrorMessage(error.message);
      var errorValue = extractValueFromErrorMessage(error.message);
      obj.status = res.status;
      obj.title = 'Invalid Attribute';
      obj.detail = 'That value ' + errorValue + ' is already in use. Please use another.';
      obj.source = { pointer: '/data/attributes/' + _.kebabCase(errorPath).toLowerCase() };
    } else {
      obj.status = res.status;
      obj.title = error.name;
      obj.detail = error.message;
    }


    return obj;
  }

  var errorsArray = res.errors;
  var err = res.errors[0];
  var errStatus = getErrCode(err.name);

  debug(res.errors);
  debug(err.name);

  res.status(errStatus);
  errorsArray = _.map(errorsArray, toJSONErrorObject);

  res.json({
    errors: errorsArray
  });
};