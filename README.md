# RESTful Goose

Yet another RESTful microservice generator for Mongoose with an emphasis on flexibility

## Installation
```
npm install restful-goose
```

## Use
```
var express = require('express');
var mongoose = require('mongoose');
var restfulGoose = require('restful-goose');

var app = express();

var mySchema = new mongoose.Schema({});
mongoose.model('MyModel', mySchema);

var api = restfulGoose(mongoose.model('MyModel'));

app.use('/api/my-models/', api);
```
