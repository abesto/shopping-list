(function () {
  "use strict";

  var Bacon = require('baconjs').Bacon,
  _ = require('lodash');

  function isEmpty(e) { return function (l) { return e === (l.length === 0); }; }
  function fst(a) { return a; }
  function nop() {}

  function freeItemKey() {
    return 'item';
  }

  var itemKey, itemsKey, fields;

  fields = ['tabId', 'text', 'position', 'done'];

  function extractFields(input) {
    var input, output, i;
    output = {};
    for (i = 0; i < fields.length; i += 1) {
      output[fields[i]] = input[fields[i]];
    }
    return output;
  }

  function updateWithFields(target, source) {
    var i;
    for (i = 0; i < fields.length; i += 1) {
      target[fields[i]] = source[fields[i]];
    }
  }

  itemKey = exports.itemKey = function itemKey(item) {
    return 'item:' + item;
  };

  itemsKey = exports.itemsKey = function itemsKey(tab) {
    return 'tab:' + tab + ':items';
  };

  exports.create = function (req, res) {
    var inputData, id, data, create, addToList;
    inputData = extractFields(req.body);
    id = Bacon.fromNodeCallback(redis.incr, freeItemKey());
    data = id.map(function(id) { inputData.id = id; return inputData; });
    create = Bacon.combineAsArray(
      id.map(itemKey), data.map(JSON.stringify)
    ).map(Bacon.redis('set'));
    itemsKey = data.map('.tabId').map(itemsKey);
    addToList = Bacon.combineAsArray(itemsKey, id).map(Bacon.redis('set'));
    Bacon.combineWith([data, create, addToList], fst).respond(res);
  };

  exports.list = function (req, res) {
    var ids, noItems, keys, items;
    ids = Bacon.fromNodeCallback(redis.lrange, itemsKey(req.query.tab), 0, -1);
    noItems = ids.filter(isEmpty(true)).map([]);
    keys = ids.filter(isEmpty(false)).map(_.partialRight(_.map, itemKey));
    items = keys.map(Bacon.redis('mget'));
    items.merge(noItems).respond(res);
  };

  exports.update = function (req, res) {
    var id = req.params.id;
    redis.get(itemKey(id), function (err, item) {
      if (err) { res.send(500, err); }
      var obj = JSON.parse(item);
      updateWithFields(obj, req.body);
      redis.set(itemKey(id), JSON.stringify(obj), function (err) {
        if (err) { return res.send(500, err); }
        res.send(obj);
      });
    });
  };

  exports.delete = function (req, res) {
    var id = req.params.id;
    redis.get(itemKey(id), function (err, item) {
      if (err) { res.send(500, err); }
      var obj = JSON.parse(item);
      redis.lrem(itemsKey(obj.tabId), 1, obj.id, function (err) {
        if (err) { res.send(500, err); }
        redis.del(itemKey(id), function (err) {
          if (err) { res.send(500, err); }
          res.send(200);
        });
      });
    });
  };
}());
