(function () {
    "use strict";


    function freeTabKey() {
        return 'tab';
    }

    function tabsKey() {
        return 'tabs';
    }

    function tabKey(tab) {
        return 'tab:' + tab;
    }

    var async = require('async');

    function sendAsyncAutoResults(res, dataName) {
        return function (err, results) {
            if (err) {
                console.log(err);
                res.send(500, err);
            } else {
                res.send(results[dataName]);
            }
        }
    }

    exports.create = function (req, res) {
        async.auto({
            get_key: function(callback) { redis.incr(freeTabKey(), callback); },
            data: ['get_key', function (callback, results) {
                callback(null, {text: req.body.text, id: results.get_key});
            }],
            create_item: ['get_key', 'data', function(callback, results) {
                redis.set(tabKey(results.get_key), JSON.stringify(results.data), callback);
            }],
            add_to_list: ['get_key', function (callback, results) {
                redis.rpush(tabsKey(), results.get_key, callback);
            }]
        }, sendAsyncAutoResults(res, 'data'));
    };

    exports.update = function (req, res) {
        var id = req.params.id;
        async.auto({
            get_tab_json: function (callback) { redis.get(tabKey(id), callback); },
            get_tab_obj: ['get_tab_json', function (callback, results) {
                callback(null, JSON.parse(results.get_tab_json));
            }],
            update: ['get_tab_obj', function (callback, results) {
                var obj = results.get_tab_obj;
                obj.text = req.body.text;
                redis.set(tabKey(id), JSON.stringify(obj), callback);
            }],
            data: ['update', function (callback, results) {
                callback(null, results.get_tab_obj);
            }]
        }, sendAsyncAutoResults(res, 'data'));
    };

    exports.list = function (req, res) {
        async.auto({
            get_ids: function (callback) { redis.lrange(tabsKey(), 0, -1, callback); },
            get_keys: ['get_ids', function (callback, results) {
                var i, keys = [];
                for (i = 0;i < results.get_ids.length; i += 1) {
                    keys.push(tabKey(results.get_ids[i]));
                }
                callback(null, keys);
            }],
            get_item_jsons: ['get_keys', function (callback, results) {
                if (results.get_keys.length > 0) {
                    redis.mget(results.get_keys, callback);
                } else {
                    callback(null, []);
                }
            }],
            get_item_objs: ['get_item_jsons', function (callback, results) {
                var i, objs = [];
                for (i = 0; i < results.get_item_jsons.length; i += 1) {
                    objs.push(JSON.parse(results.get_item_jsons[i]));
                }
                callback(null, objs);
            }]
        }, sendAsyncAutoResults(res, 'get_item_objs'));
    };

    exports.delete = function (req, res) {
        var id = req.params.id,
            itemsKey = require('./item').itemsKey(id);

        async.auto({
            get_item_ids: function (callback) {
                redis.lrange(itemsKey, 0, -1, callback);
            },
            get_item_keys: ['get_item_ids', function (callback, results) {
                var i, keys = [];
                for (i = 0; i < results.get_item_ids.length; i += 1) {
                    keys.push(require('./item').itemKey(results.get_item_ids[i]));
                }
                callback(null, keys);
            }],
            delete_items: ['get_item_keys', function (callback, results) {
                var keys = results.get_item_keys.concat([itemsKey]);
                console.log(results.get_item_keys, keys);
                redis.del(keys, callback);
            }],
            delete_tab: function (callback) {
                redis.del(tabKey(id), callback);
            },
            delete_from_tablist: function (callback) {
                redis.lrem(tabsKey(), 1, id, callback);
            }
        }, sendAsyncAutoResults(res, 'delete_from_tablist'));
    };
}());
