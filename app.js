
/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    tab = require('./routes/tab'),
    item = require('./routes/item'),
    http = require('http'),
    path = require('path'),
    redis = require('redis'),
    _ = require('lodash');

var app = express();
global.redis = redis.createClient();
global.redis.select(1);
_.bindAll(global.redis);


app.configure(function () {
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

app.get('/', routes.index);

app.get('/tab', tab.list);
app.post('/tab', tab.create);
app.put('/tab/:id', tab.update);
app.delete('/tab/:id', tab.delete);

app.get('/item', item.list);
app.post('/item', item.create);
app.put('/item/:id', item.update);
app.delete('/item/:id', item.delete);


http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});
