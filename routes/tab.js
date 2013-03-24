(function () {
  "use strict";

  var Bacon = require('baconjs').Bacon,
      _ = require('lodash');


  function freeTabKey() {
    return 'tab';
  }

  function tabsKey() {
    return 'tabs';
  }

  function tabKey(tab) {
    return 'tab:' + tab;
  }

  function isEmpty (e) { return function (l) { return e === (l.length === 0); }; }
  function fst (a, b) { return a; }
  function nop () {}

  Bacon.redis = function () {
    var args = _.toArray(arguments);
    var method = args.shift();
    return _.partial.apply(this, [Bacon.fromNodeCallback, redis[method]].concat(args));
  };

  Bacon.Observable.prototype.respond = function(res) {
    this.onValue(_.bind(res.send, res));
    this.onError(_.bind(res.send, res, 500));
    return this;
  };

  exports.create = function (req, res) {
    var id = Bacon.fromNodeCallback(redis.incr, freeTabKey());
    var key = id.map(tabKey);
    var item = id.map(function (id) { return {text: req.body.text, id: id}; });
    var create = Bacon.combineAsArray(key, item.map(JSON.stringify)).flatMap(Bacon.redis('set'));
    var addToList = id.flatMap(Bacon.redis('rpush', tabsKey()));
    Bacon.combineWith([item, create, addToList], fst).respond(res);
  };

  exports.update = function (req, res) {
    var key = tabKey(req.params.id);
    var json = Bacon.redis('get')(key);
    var obj = json.map(JSON.parse).map(function (o) { o.text = req.body.text; return o; });
    var update = obj.map(JSON.stringify).flatMap(Bacon.redis('set', key));
    update.respond(res);
  };

  exports.list = function (req, res) {
    var ids = Bacon.fromNodeCallback(redis.lrange, tabsKey(), 0, -1);
    var keys = ids.filter(isEmpty(false)).map(_.partialRight(_.map, tabKey));
    var jsons = keys.flatMap(Bacon.redis('mget'));
    ids.filter(isEmpty(true)).respond(res);
    jsons.map(_.partialRight(_.map, JSON.parse)).respond(res);
  };

  exports.delete = function (req, res) {
    var tabId = Bacon.once(req.params.id).toProperty();
    var _tabKey = tabId.map(tabKey);
    var itemsOfTabKey = tabId.map(require('./item').itemsKey);
    var itemIds = itemsOfTabKey.flatMap(_.partialRight(Bacon.redis('lrange'), 0, -1));
    var noItems = itemIds.filter(isEmpty(true));
    // Delete items, if any
    var itemKeys = itemIds.filter(isEmpty(false)).map(_.partialRight(_.map, require('./item').itemKey));
    var deleteItems = itemKeys.flatMap(Bacon.redis('del'));
    // Delete the tab itself
    var deleteTabFromTablist = tabId.flatMap(Bacon.redis('lrem', tabsKey(), 1));
    var deleteTab = _tabKey.flatMap(Bacon.redis('del'));
    Bacon.combineWith([deleteItems.merge(noItems), deleteTabFromTablist, deleteTab], nop).respond(res);
  };
}());
