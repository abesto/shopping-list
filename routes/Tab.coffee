Bacon  = require('baconjs').Bacon
_ = require('lodash')

tabKey = (id) -> "tab:#{id}"
tabsListKey = 'tabs'
empty = (x) -> x.length == 0
notEmpty = (x) -> not empty(x)

module.exports = (redis) ->
  require('../bacon_helpers').decorate(Bacon, redis)
  return {
     list: (req, res) ->
       idsResponse = Bacon.redis('lrange', tabsListKey, 0, -1)
       noTabs = idsResponse.filter(empty).map([])
       keys = idsResponse.filter(notEmpty).mapmapRight(tabKey)
       jsons = Bacon.redis('mget', keys)
       tabs = jsons.mapmapRight(JSON.parse)
       tabs.merge(noTabs).respond(res)

    create: (req, res) ->
      id = Bacon.redis('incr', 'tab').toProperty()
      key = id.map(tabKey)
      data = id.map (id) -> {id: id, text: req.body.text}
      json = data.map(JSON.stringify).toProperty()
      create = Bacon.redis('set', key, json)
      addToList = Bacon.redis('rpush', tabsListKey, id.sampledBy(create))
      json.sampledBy(addToList).respond(res, 201)

    update: (req, res) ->
      id = req.params.id
      key = tabKey(id)
      oldTab = Bacon.redis('get', key).toProperty().map(JSON.parse)
      tabNotFound = oldTab.map((x) -> x == null).toProperty()
      idMismatch = oldTab.map((t) -> 'id' of req.body && req.body.id != t.id).toProperty()
      requestOk = tabNotFound.or(idMismatch).not()
      newTab = oldTab.filter(requestOk).map((t) -> t.text = req.body.text; t)
      update = Bacon.redis('set', key, newTab.map(JSON.stringify))
      update.map(null).respond(res, 204)
      oldTab.filter(tabNotFound).map({error: 'tab not found'}).respond(res, 404)
      oldTab.filter(idMismatch).map({error: 'id is read-only'}).respond(res, 400)

    delete: (req, res) ->
      id = req.params.id
      lrem = Bacon.redis('lrem', tabsListKey, 0, id)
      del = lrem.flatMap -> Bacon.redis('del', tabKey(id))
      del.map(null).respond(res, 204)
  }