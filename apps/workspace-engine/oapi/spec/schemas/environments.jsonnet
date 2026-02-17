local openapi = import '../lib/openapi.libsonnet';

{
  Environment: {
    type: 'object',
    required: ['id', 'name', 'createdAt', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
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
