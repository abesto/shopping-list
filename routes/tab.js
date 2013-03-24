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

  function isEmpty(e) { return function (l) { return e === (l.length === 0); }; }
  function fst(a) { return a; }
  function nop() {}

  Bacon.redis = function () {
    var args, method;
    args = _.toArray(arguments);
    method = args.shift();
    return _.partial.apply(this, [Bacon.fromNodeCallback, redis[method]].concat(args));
  };

  Bacon.Observable.prototype.respond = function (res) {
    this.onValue(_.bind(res.send, res));
    this.onError(_.bind(res.send, res, 500));
    return this;
  };

  exports.create = function (req, res) {
    var id, key, item, create, addToList;
    id = Bacon.fromNodeCallback(redis.incr, freeTabKey());
    key = id.map(tabKey);
    item = id.map(function (id) { return {text: req.body.text, id: id}; });
    create = Bacon.combineAsArray(key, item.map(JSON.stringify)).flatMap(Bacon.redis('set'));
    addToList = id.flatMap(Bacon.redis('rpush', tabsKey()));
    Bacon.combineWith([item, create, addToList], fst).respond(res);
  };

  exports.update = function (req, res) {
    var key, json, obj, update;
    key = tabKey(req.params.id);
    json = Bacon.redis('get')(key);
    obj = json.map(JSON.parse).map(function (o) { o.text = req.body.text; return o; });
    update = obj.map(JSON.stringify).flatMap(Bacon.redis('set', key));
    update.respond(res);
  };

  exports.list = function (req, res) {
    var ids, keys, jsons;
    ids = Bacon.fromNodeCallback(redis.lrange, tabsKey(), 0, -1);
    keys = ids.filter(isEmpty(false)).map(_.partialRight(_.map, tabKey));
    jsons = keys.flatMap(Bacon.redis('mget'));
    ids.filter(isEmpty(true)).respond(res);
    jsons.map(_.partialRight(_.map, JSON.parse)).respond(res);
  };

  exports['delete'] = function (req, res) {
    var tabId, _tabKey, itemsOfTabKey, itemIds, noItems, itemKeys, deleteItems, deleteTabFromTablist, deleteTab;
    tabId = Bacon.once(req.params.id).toProperty();
    _tabKey = tabId.map(tabKey);
    itemsOfTabKey = tabId.map(require('./item').itemsKey);
    itemIds = itemsOfTabKey.flatMap(_.partialRight(Bacon.redis('lrange'), 0, -1));
    noItems = itemIds.filter(isEmpty(true));
    // Delete items, if any
    itemKeys = itemIds.filter(isEmpty(false)).map(_.partialRight(_.map, require('./item').itemKey));
    deleteItems = itemKeys.flatMap(Bacon.redis('del'));
    // Delete the tab itself
    deleteTabFromTablist = tabId.flatMap(Bacon.redis('lrem', tabsKey(), 1));
    deleteTab = _tabKey.flatMap(Bacon.redis('del'));
    Bacon.combineWith([deleteItems.merge(noItems), deleteTabFromTablist, deleteTab], nop).respond(res);
  };
}());
