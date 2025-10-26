local openapi = import '../lib/openapi.libsonnet';

{
  UpsertEnvironmentRequest: {
    type: 'object',
    required: ['systemId', 'name'],
    properties: {
      systemId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
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
    },
  },
  EnvironmentAndSystem: {
    type: 'object',
    required: ['environment', 'system'],
    properties: {
      environment: openapi.schemaRef('Environment'),
      system: openapi.schemaRef('System'),
    },
  },
}

