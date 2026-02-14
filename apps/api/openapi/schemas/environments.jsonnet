local openapi = import '../lib/openapi.libsonnet';

{
  CreateEnvironmentRequest: {
    type: 'object',
    required: ['systemIds', 'name'],
    properties: {
      systemIds: { type: 'array', items: { type: 'string' } },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
  UpsertEnvironmentRequest: {
    type: 'object',
    required: ['systemIds', 'name'],
    properties: {
      systemIds: { type: 'array', items: { type: 'string' } },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
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
    required: ['id', 'name', 'systemIds', 'createdAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      systemIds: { type: 'array', items: { type: 'string' } },
      resourceSelector: openapi.schemaRef('Selector'),
      createdAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
}
