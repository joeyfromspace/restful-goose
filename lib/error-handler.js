var crypto = require('crypto');
var _ = require('lodash');

/**
 * Default error-handling middleware
 * @middleware
 *
 */
module.exports = function(req, res) {
  'use strict';
  var err = res.errors[0];
  var log = res.rg.log;
  function getErrCode(errName) {
    switch (errName) {
      case 'BadRequest':
        return 400;

      case 'MongoError':
      case 'MongooseError':
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

  function toJSONErrorObject(error) {
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

    if (error.name === 'MongoError' && error.code === 11000) {
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
  function parseValidationErrors(err, path) {
    var o = {};

    o.status = 403;
    o.detail = err.message.charAt(0).toUpperCase() + err.message.substr(1);
    o.title = 'ValidationError';
    o.source = { pointer: '/data/attributes/' + _.kebabCase(path).toLowerCase() };

    return o;
  }

  var suppress = res.rg.suppress4xxErrors;
  var errorsArray = _.flatten(res.errors);
  var errStatus = getErrCode(err.name);
  var logError = function(err) {
    var level = !!suppress && (errStatus >= 400 || errStatus <= 499) ? 'info' : 'error';
    log[level](err.name + '\n' + err.message + '\n' + err.stack);
  };

  res.errors.forEach(logError);
  res.status(errStatus);
  errorsArray = err.name === 'ValidationError' ? _.toArray(_.mapValues(err.errors, parseValidationErrors)) : _.map(errorsArray, toJSONErrorObject);

  res.json({
    errors: errorsArray
  });
};
