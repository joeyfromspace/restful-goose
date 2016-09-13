var mongoose = require('mongoose');
var debug = require('debug')('restful-goose:requesttest-schema');

module.exports = (function() {
  'use strict';
  var RequestTestSchema = new mongoose.Schema({
    name: { type: mongoose.Schema.Types.String, index: true },
    isCool: { type: mongoose.Schema.Types.Boolean, default: true },
    rank: { type: mongoose.Schema.Types.Number, default: 14 },
    subs: { type: [mongoose.Schema.Types.ObjectId], ref: 'SubTest' }
  }, { timestamps: true });

  RequestTestSchema.pre('remove', function(next) {
    debug('Running pre-remove hook on ' + this.constructor.modelName);
    this.constructor.db.model('SubTest').remove({ parent: this._id }, next);
  });

  return RequestTestSchema;
}());