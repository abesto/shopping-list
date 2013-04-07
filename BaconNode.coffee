_ = require('lodash')

exports.decorate = (Bacon) ->
  Bacon.Observable::respond = (res) ->
    @onValue (response) ->
      res.send response.status, response.body
    @onError _.bind(res.send, res, 500)

  Bacon.respond = (res) -> (template) ->
    Bacon.combineTemplate(template).respond(res)

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