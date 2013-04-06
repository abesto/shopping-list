_ = require('lodash')

exports.decorate = (Bacon) ->
  Bacon.Observable::respond = (res, retCode) ->
    stream = @endOnError()
    stream.onValue _.bind(res.send, res, retCode || 200)
    stream.onError _.bind(res.send, res, 500)
    stream

  Bacon.Observable::mapEach = (f) ->
    @map _.partialRight(_.map, f)

  Bacon.wrapNodeApiObject = (obj) ->
    ret = {}
    for name, method of obj
      continue unless method instanceof Function
      do (name) ->
        ret[name] = (args...) ->
          Bacon.fromNodeCallback obj[name], args...
    ret