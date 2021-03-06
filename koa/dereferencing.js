'use strict'

const clone = require('clone')

/** Resolves all schema references by inserting their actual definitions **/
function dereferenceSchema(schema, definitions) {
  for (let property in schema) {
    if (!schema[property].isJoi) {
      dereferenceSchema(schema[property], definitions)
    } else {
      findReferences(schema, property, definitions)
    }
  }
}

/** Recursively finds and replaces all subschema reference definitions **/
function findReferences(schema, property, definitions) {
  let subschema = schema[property]
  let {className} = (subschema._meta || []).find(meta => meta.className) || {}
  /* Replace reference with definition or keep looking in joi._inner.children */
  if (className && definitions[className]) {
    schema[property] = clone(definitions[className])
    Object.assign(schema[property]._flags || {}, subschema._flags)
  } else if (subschema._inner && subschema._inner.children) {
    for (let child of subschema._inner.children) {
      findReferences(child, 'schema', definitions)
      /* the 'schema' parameter is a property of joi {key, schema} elements */
    }
  }
}

module.exports = dereferenceSchema
