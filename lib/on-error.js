/**
 * Default error-handling middleware
 * @middleware
 *
 */
module.exports = function(req, res, err) {
  var getErrCode = function(errName) {
    switch (errName) {
      case 'ValidationError':
        return 400;

      case 'CastError':
        return 400;

      case 'AuthorizationError':
        return 401;

      default:
        return 500;
    }
  };
  var errStatus = getErrCode(err.name);

  res.status(errStatus).json({
    success: false,
    error: err.name,
    message: err.message
  });
};