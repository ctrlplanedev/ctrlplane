local openapi = import '../lib/openapi.libsonnet';

{
  CreateEnvironmentRequest: {
    type: 'object',
    required: ['systemId', 'name'],
    properties: {
      systemId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
  UpsertEnvironmentRequest: {
    type: 'object',
    required: ['systemId', 'name'],
    properties: {
      systemId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  Environment: {
    type: 'object',
    required: ['id', 'name', 'systemId', 'createdAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      systemId: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
      createdAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
}
