Bacon  = require('baconjs').Bacon
_ = require('lodash')
require('../BaconNode').decorate(Bacon)

tabKey = (id) -> "tab:#{id}"
tabsListKey = 'tabs'
empty = (x) -> x.length == 0
notEmpty = (x) -> not empty(x)
isTrue = (x) -> x == true


module.exports = (redis) ->
  Bacon.redis = Bacon.wrapNodeApiObject redis
  return {
     list: (req, res) ->
      keys = Bacon.redis.lrange(tabsListKey, 0, -1).mapEach(tabKey)
      tabs = Bacon.redis.mget(keys.filter(notEmpty)).mapEach(JSON.parse)
      noTabs = keys.filter(empty)
      Bacon.respond(res) status: 200, body: tabs.merge(noTabs)

    create: (req, res) ->
      id = Bacon.redis.incr('tab').toProperty()
      key = id.map(tabKey)
      json = Bacon.combineTemplate({id: id, text: req.body.text}).map(JSON.stringify)
      create = Bacon.redis.set(key, json)
      addToList = create.flatMap -> Bacon.redis.rpush(tabsListKey, id)
      Bacon.respond(res) status: 201, body: addToList.map(json)

    update: (req, res) ->
      id = req.params.id
      key = tabKey(id)
      oldTab = Bacon.redis.get(key).toProperty().map(JSON.parse)
      response = oldTab.flatMap (tab) ->
        if tab == null
          Bacon.once(status: 404, body: {error: 'tab not found'})
        else if 'id' of req.body && req.body.id != tab.id
          Bacon.once(status: 400, body: {error: 'id is read-only'})
        else
          tab.text = req.body.text
          update = Bacon.redis.set(key, JSON.stringify(tab))
          update.map(status: 204, body: null)
      response.respond(res)

    delete: (req, res) ->
      id = req.params.id
      lrem = Bacon.redis.lrem(tabsListKey, 0, id)
      del = lrem.flatMap -> Bacon.redis.del(tabKey(id))
      Bacon.respond(res) status: 204, body: del.map(null)
  }