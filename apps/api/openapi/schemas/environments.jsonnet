local openapi = import '../lib/openapi.libsonnet';

{
  CreateEnvironmentRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the environment should be used' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
  UpsertEnvironmentRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the environment should be used' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  EnvironmentRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },

  Environment: {
    type: 'object',
    required: ['id', 'name', 'createdAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the environment should be used' },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
  
  EnvironmentWithSystems: {
    allOf: [
      openapi.schemaRef('Environment'),
      {
        type: 'object',
        required: ['systems'],
        properties: {
          systems: { type: 'array', items: openapi.schemaRef('System') },
        },
      },
    ],
  },
}
