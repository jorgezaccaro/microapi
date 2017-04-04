'use strict'

const joi = require('joi')
const joiOptions = {stripUnknown: true}
const wrapSections = ['path', 'query', 'body']
const validSections = ['path', 'query', 'body', 'header']

function validation({ schemas = {}, method }) {
  let {[method]: {
    definitions: {request = {}, response = {}} = {},
    validations: {request: validateRequest, response: validateResponse} = {}
  } = {} } = schemas

  for (let section in request)
    if (validSections.indexOf(section) < 0) delete request[section]
  for (let section of wrapSections)
    request[section] = joi.object().keys(request[section] || {})

  return async (context, next) => {
    let body
    try {
      await validateSchemas(context, request)
      if (validateRequest) await validateRequest(context.request)
      await next() // route handler
      if (validateResponse) body = await validateResponse(context.response)
    } catch (error) {
      let {body: responseBody, status = 400} = error
      body = responseBody || error
      context.status = status
    } finally {
      context.response.body = body || context.response.body
    }
  }
}

function validateSchemas(context, definitions) {
  let sections = Object.keys(definitions)
  let promises = sections.map(section => {
    let schema = definitions[section]
    return validationPromise(context, {section, schema})
  })
  return Promise.all(promises)
}

joi.validatePromise = (value, schema, options = {}) => {
  return new Promise((resolve, reject) => {
    joi.validate(value, schema, options, (err, value) => {
      err ? reject(err) : resolve(value)
    })
  })
}

function validationPromise({request, params}, {section, schema}) {
  let promise

  switch (section) {
  case 'path':
    promise = joi.validatePromise(params, schema, joiOptions)
      .then(value => params = value)
    break;
  case 'query': case 'body':
    promise = joi.validatePromise(request[section], schema, joiOptions)
      .then(value => request[section] = value)
    break;
  case 'header':
    promise = Promise.all(Object.keys(schema).map(name => {
      let value = (request[section] || {})[name]
      return joi.validatePromise(value, schema[name], joiOptions)
    }))
    break;
  default:
    promise = Promise.resolve()
  }

  return promise
}

module.exports = validation
