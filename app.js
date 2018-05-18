var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var fs = require('fs');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var mapRouter = require('./routes/map');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/** bodyParser.urlencoded(options)
 * Parses the text as URL encoded data (browsers send form data to POST)
 * and exposes the resulting object (containing the keys and values) on req.body
 * 
 * Taken from: https://stackoverflow.com/questions/4295782/how-do-you-extract-post-data-in-node-js
 */
app.use(bodyParser.urlencoded({
    extended: true
}));

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 * 
 * Taken from: https://stackoverflow.com/questions/4295782/how-do-you-extract-post-data-in-node-js
 */
app.use(bodyParser.json());

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/map', mapRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
