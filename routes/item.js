(function () {
    "use strict";

    function freeItemKey() {
        return 'item';
    }

    var itemKey, itemsKey;

    itemKey = exports.itemKey = function itemKey(item) {
        return 'item:' + item;
    };

    itemsKey = exports.itemsKey = function itemsKey(tab) {
        return 'tab:' + tab + ':items';
    };

    exports.create = function (req, res) {
        var data = {
            tabId: req.body.tabId,
            text: req.body.text
        };
        redis.incr(freeItemKey(), function (err, id) {
            if (err) { return res.send(500, err); }
            data.id = id;
            redis.set(itemKey(id), JSON.stringify(data), function (err) {
                if (err) { return res.send(500, err); }
                redis.rpush(itemsKey(data.tabId), id, function (err) {
                    if (err) { return res.send(500, err); }
                    res.send(data);
                });
            });
        });
    };

    exports.list = function (req, res) {
        var tab = req.query.tab;
        redis.lrange(itemsKey(tab), 0, -1, function (err, itemIds) {
            var i, itemKeys;
            if (err) { return res.send(500, 'LRANGE failed: ' + err); }
            if (itemIds.length === 0) { return res.send([]); }
            itemKeys = [];
            for (i = 0; i < itemIds.length; i += 1) {
                itemKeys.push(itemKey(itemIds[i]));
            }
            redis.mget(itemKeys, function (err, items) {
                var i, objs = [];
                if (err) { return res.send(500, 'MGET failed: ' + err); }
                for (i = 0; i < items.length; i += 1) {
                    objs.push(JSON.parse(items[i]));
                }
                res.send(objs);
            });
        });
    };

    exports.update = function (req, res) {
        var id = req.params.id;
        redis.get(itemKey(id), function (err, item) {
            if (err) { res.send(500, err); }
            var obj = JSON.parse(item);
            obj.done = req.body.done;
            obj.text = req.body.text;
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