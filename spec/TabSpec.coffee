sinon = require('sinon')
_ = require('lodash')

redisApi = {
  incr: (key, cb) ->
  mget: (keys..., cb) ->
  get: (key, cb) ->
  set: (key, value, cb) ->
  rpush: (key, value, cb) ->
  lrange: (key, from, to, cb) ->
  del: (key, cb) ->
  lrem: (key, n, item, cb) ->
}
res = {
  send: ->
}

tab = require('../routes/Tab')(redisApi)

endWith = (done, expectedArgs, mocks...) ->
  res.send = (args...) ->
    expect(args).toEqual(expectedArgs)
    mock.verify() for mock in mocks
    done()


describe 'Tab', ->
  redis = null

  beforeEach ->
    redis?.restore?()
    redis = sinon.mock(redisApi)

  describe 'Tab.list', ->
    tabs = [
      {id: 10, text: 'tab10'}
      {id: 42, text: 'tab42'}
    ]
    jsons = (JSON.stringify(t) for t in tabs)
    tabIds = (t.id for t in tabs)
    tabKeys = ("tab:#{id}" for id in tabIds)

    req = {}

    it 'lists tabs', (done) ->
      redis.expects('lrange').once().withArgs('tabs', 0, -1).callsArgWithAsync(3, null, tabIds)
      redis.expects('mget').once().withArgs(tabKeys).callsArgWithAsync(1, null, jsons)
      endWith(done, [200, tabs], redis)
      tab.list(req, res)

    it 'handles empty tabs list', (done) ->
      redis.expects('lrange').once().withArgs('tabs', 0, -1).callsArgWithAsync(3, null, [])
      redis.expects('mget').never()
      endWith(done, [200, []], redis)
      tab.list(req, res)

    it 'handles error on lrange', (done) ->
      errorMsg = 'lrange error'
      redis.expects('lrange').once().withArgs('tabs', 0, -1).callsArgWithAsync(3, errorMsg)
      redis.expects('mget').never()
      endWith(done, [500, errorMsg], redis)
      tab.list(req, res)

    it 'handles error on mget', (done) ->
      errorMsg = 'mget error'
      redis.expects('lrange').once().withArgs('tabs', 0, -1).callsArgWithAsync(3, null, tabIds)
      redis.expects('mget').once().withArgs(tabKeys).callsArgWithAsync(1, errorMsg)
      endWith(done, [500, errorMsg], redis)
      tab.list(req, res)

  describe 'Tab.create', ->
    newTab = {
        id: 42
        text: 'tab-text'
    }
    tabKey = "tab:#{newTab.id}"
    json = JSON.stringify(newTab)
    req = {body: {text: newTab.text}}

    it 'creates the tab, adds it to tabs list', (done) ->
      redis.expects('incr').once().withArgs('tab').callsArgWithAsync(1, null, newTab.id)
      redis.expects('set').once().withArgs(tabKey, json).callsArgWithAsync(2, null)
      redis.expects('rpush').once().withArgs('tabs', newTab.id).callsArgWithAsync(2, null)
      endWith(done, [201, json], redis)
      tab.create(req, res)

    it 'handles error in incr', (done) ->
      errorMsg = 'incr error'
      redis.expects('incr').once().withArgs('tab').callsArgWithAsync(1, errorMsg)
      redis.expects('set').never()
      redis.expects('rpush').never()
      endWith(done, [500, errorMsg], redis)
      tab.create(req, res)

    it 'handles error in set', (done) ->
      errorMsg = 'set error'
      redis.expects('incr').once().withArgs('tab').callsArgWithAsync(1, null, newTab.id)
      redis.expects('set').once().withArgs(tabKey, json).callsArgWithAsync(2, errorMsg)
      redis.expects('rpush').never()
      endWith(done, [500, errorMsg], redis)
      tab.create(req, res)

    it 'handles error in rpush', (done) ->
      errorMsg = 'rpush error'
      redis.expects('incr').once().withArgs('tab').callsArgWithAsync(1, null, newTab.id)
      redis.expects('set').once().withArgs(tabKey, json).callsArgWithAsync(2, null)
      redis.expects('rpush').once().withArgs('tabs', newTab.id).callsArgWithAsync(2, errorMsg)
      endWith(done, [500, errorMsg], redis)
      tab.create(req, res)

  describe 'Tab.update', ->
    oldTab = {
      id: 19
      text: 'original text'
    }
    oldTabJson = JSON.stringify(oldTab)
    newTab = {
      id: 19
      text: 'modified text'
    }
    newTabJson = JSON.stringify(newTab)
    req = {body: {text: newTab.text}, params: {id: oldTab.id}}
    tabKey = "tab:#{oldTab.id}"

    it 'can change tab text', (done) ->
      redis.expects('get').once().withArgs(tabKey).callsArgWithAsync(1, null, oldTabJson)
      redis.expects('set').once().withArgs(tabKey, newTabJson).callsArgWithAsync(2, null)
      endWith(done, [204, null], redis)
      tab.update(req, res)

    it 'can not change tab id', (done) ->
      badReq = _.cloneDeep(req)
      badReq.body.id = req.params.id + 10
      redis.expects('get').once().withArgs(tabKey).callsArgWithAsync(1, null, oldTabJson)
      redis.expects('set').never()
      endWith(done, [400, {error: 'id is read-only'}], redis)
      tab.update(badReq, res)

    it 'returns 404 if tab does not exist', (done) ->
      redis.expects('get').once().withArgs(tabKey).callsArgWithAsync(1, null, null)
      redis.expects('set').never()
      endWith(done, [404, {error: 'tab not found'}], redis)
      tab.update(req, res)

    it 'handles error in get', (done) ->
      errorMsg = 'get error'
      redis.expects('get').once().withArgs(tabKey).callsArgWithAsync(1, errorMsg)
      redis.expects('set').never()
      endWith(done, [500, errorMsg], redis)
      tab.update(req, res)

    it 'handles error in set', (done) ->
      errorMsg = 'set error'
      redis.expects('get').once().withArgs(tabKey).callsArgWithAsync(1, null, oldTabJson)
      redis.expects('set').once().withArgs(tabKey, newTabJson).callsArgWithAsync(2, errorMsg)
      endWith(done, [500, errorMsg], redis)
      tab.update(req, res)

  describe 'Tab.delete', (done) ->
    id = 13
    key = "tab:#{id}"
    req = {params: {id: id}}

    it 'deletes from list of tabs and also the tab data', (done) ->
      redis.expects('lrem').once().withArgs('tabs', 0, id).callsArgWithAsync(3, null, 1)
      redis.expects('del').once().withArgs(key).callsArgWithAsync(1, null)
      endWith(done, [204, null], redis)
      tab.delete(req, res)

    it 'does not mind if the tab is not in the list' , (done) ->
      redis.expects('lrem').once().withArgs('tabs', 0, id).callsArgWithAsync(3, null, 0)
      redis.expects('del').once().withArgs(key).callsArgWithAsync(1, null, 1)
      endWith(done, [204, null], redis)
      tab.delete(req, res)

    it 'does not mind if the tab does not exist' , (done) ->
      redis.expects('lrem').once().withArgs('tabs', 0, id).callsArgWithAsync(3, null, 1)
      redis.expects('del').once().withArgs(key).callsArgWithAsync(1, null, 0)
      endWith(done, [204, null], redis)
      tab.delete(req, res)

    it 'handles error on lrem', (done) ->
      errorMsg = 'lrem error'
      redis.expects('lrem').once().withArgs('tabs', 0, id).callsArgWithAsync(3, errorMsg)
      redis.expects('del').never()
      endWith(done, [500, errorMsg], redis)
      tab.delete(req, res)

    it 'handles error on del', (done) ->
      errorMsg = 'del error'
      redis.expects('lrem').once().withArgs('tabs', 0, id).callsArgWithAsync(3, null, 1)
      redis.expects('del').once().withArgs(key).callsArgWithAsync(1, errorMsg)
      endWith(done, [500, errorMsg], redis)
      tab.delete(req, res)