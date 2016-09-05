var mongoose = require('mongoose');
var debug = require('debug')('restful-goose:subtest-schema');

module.exports = (function() {
  'use strict';
  var SubTestSchema = new mongoose.Schema({
    name: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'RequestTest'}
  }, { timestamps: true });

  SubTestSchema.pre('save', function(next) {
    var _this = this;
    var RequestTest = this.constructor.db.model('RequestTest');
    
    if (this.isNew || this.isModified('parent')) {
      RequestTest.findOneAndUpdate({ subs: this._id }, { $pull: { subs: this._id }}, function() {
        RequestTest.findOneAndUpdate({ _id: _this.parent }, { $push: { subs: _this._id }}, next);
      });
    } else {
      next();
    }
  });

  SubTestSchema.pre('remove', function(next) {
    this.constructor.db.model('RequestTest').findOneAndUpdate({ _id: this.parent }, { $pull: { subs: this._id }}, next);
  });
  
  return SubTestSchema;
}());