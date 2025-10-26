local openapi = import '../lib/openapi.libsonnet';

{
  System: {
    type: 'object',
    required: ['id', 'workspaceId', 'name'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
  },
}