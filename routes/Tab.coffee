Bacon  = require('baconjs').Bacon
_ = require('lodash')

tabKey = (id) -> "tab:#{id}"
tabsListKey = 'tabs'
empty = (x) -> x.length == 0
notEmpty = (x) -> not empty(x)
isTrue = (x) -> x == true

module.exports = (redis) ->
  require('../bacon_helpers').decorate(Bacon, redis)
  return {
     list: (req, res) ->
      keys = Bacon.redis('lrange', tabsListKey, 0, -1).mapEach(tabKey)
      tabs = Bacon.redis('mget', keys.filter(notEmpty)).mapEach(JSON.parse)
      noTabs = keys.filter(empty).map([])
      tabs.merge(noTabs).respond(res, 200)

    create: (req, res) ->
      id = Bacon.redis('incr', 'tab').toProperty()
      key = id.map(tabKey)
      json = Bacon.combineTemplate({id: id, text: req.body.text}).map(JSON.stringify)
      create = Bacon.redis('set', key, json)
      addToList = create.flatMap -> Bacon.redis('rpush', tabsListKey, id)
      json.sampledBy(addToList).respond(res, 201)

    update: (req, res) ->
      id = req.params.id
      key = tabKey(id)
      oldTab = Bacon.redis('get', key).toProperty().map(JSON.parse)
      tabNotFound = oldTab.map((t) -> t == null).toProperty()
      idMismatch = oldTab.map((t) -> 'id' of req.body && req.body.id != t.id).toProperty()
      requestOk = tabNotFound.or(idMismatch).not()
      newTab = oldTab.filter(requestOk).map((t) -> t.text = req.body.text; t)
      update = Bacon.redis('set', key, newTab.map(JSON.stringify))
      update.map(null).respond(res, 204)
      tabNotFound.filter(isTrue).map({error: 'tab not found'}).respond(res, 404)
      idMismatch.filter(isTrue).map({error: 'id is read-only'}).respond(res, 400)

    delete: (req, res) ->
      id = req.params.id
      lrem = Bacon.redis('lrem', tabsListKey, 0, id)
      del = lrem.flatMap -> Bacon.redis('del', tabKey(id))
      del.map(null).respond(res, 204)
  }