local openapi = import '../lib/openapi.libsonnet';

{
  Environment: {
    type: 'object',
    required: ['id', 'name', 'createdAt', 'metadata', 'workspaceId'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the environment should be used' },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
      workspaceId: { type: 'string' },
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
