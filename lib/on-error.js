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

  function toJSONErrorObject(error) {
    var obj = {};
    
    obj.id = crypto.randomBytes(4).toString('hex');
    obj.links = {
      about: ''
    };

    if (error.name === 'ValidationError') {
      obj.status = res.status;
      obj.detail = error.message;
      obj.title = 'Invalid Attribute';
      obj.source = '/data/attributes/' + _.kebabCase(error.path).toLowerCase();
    } else if (error.name === 'MongoError' && error.code === 11000) {
      obj.status = res.status;
      obj.title = 'Invalid Attribute';
      obj.detail = error.message;
      obj.source = '/data/attributes/' + _.kebabCase(error.path).toLowerCase();
    } else {
      obj.status = res.status;
      obj.title = error.message;
      obj.detail = error.name;
      obj.source = error.detail;
    }


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