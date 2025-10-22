{
  // Parameter helpers
  stringParam(name, description):: {
    name: name,
    'in': 'path',
    required: true,
    description: description,
    schema: { type: 'string' },
  },
  
  // Response helpers
  schemaRef(name, nullable = false):: (
    if nullable then
      { '$ref': '#/components/schemas/' + name, nullable: true }
    else
      { '$ref': '#/components/schemas/' + name }
  ),
  
  okResponse(description, schema):: {
    '200': {
      description: description,
      content: {
        'application/json': {
          schema: schema,
        },
      },
    },
  },
  
  notFoundResponse():: {
    '404': {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { '$ref': '#/components/schemas/ErrorResponse' },
        },
      },
    },
  },
  
  badRequestResponse():: {
    '400': {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: { '$ref': '#/components/schemas/ErrorResponse' },
        },
      },
    },
  },
}
