var crypto = require('crypto');
var _ = require('lodash');

/**
 * Default error-handling middleware
 * @middleware
 *
 */
module.exports = function(req, res, err) {
  function getErrCode(errName) {
    switch (errName) {
      case 'BadRequest':
        return 400;

      case 'ValidationError':
        return 409;

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
    var obj = {};
    //TODO Fill out the About links object
    obj.id = crypto.randomBytes(4).toString('hex');
    obj.links = {
      about: ''
    };

    obj.status = res.status;
    obj.title = error.name;
    obj.detail = error.message;
    //TODO Figure out how to satisfy JSON API spec for source string
    obj.source = error.detail;

    return obj;
  }

  if (Array.isArray(err) === false) {
    err = [err];
  }

  var errorsArray;
  var errStatus = getErrCode(err[0].name);

  res.status(errStatus);
  errorsArray = _.map(err, toJSONErrorObject);

  res.json({
    errors: errorsArray
  });
};