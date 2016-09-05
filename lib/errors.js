var _ = require('lodash');

var RGError = function(msg, name, code) {
    this.name = name;
    this.message = msg;
    this.code = code;
};
RGError.prototype = Object.create(null);
RGError.prototype.constructor = RGError;

var ERRDEFS = {
    NOT_FOUND: {
        code: 404,
        name: 'NotFound'        
    },
    UNAUTHORZED: {
        message: 'You do not have access to this resource',
        name: 'AuthorizationError',
        code: 401        
    },
    SERVER: {
        message: 'A server error occurred. Please try again later',
        name: 'ServerError',
        code: 500
    }
};

var ERR = {};

_.forEach(ERRDEFS, function(def, key) {
    ERR[key] = function(message) {
        if (def.message) {
            message = def.message;
        }

        return new RGError(message, def.name, def.code);
    };
});

module.exports = ERR;