local openapi = import '../lib/openapi.libsonnet';

{
  CreateSystemRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
  },

  UpsertSystemRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
  },

  System: {
    type: 'object',
    required: ['id', 'workspaceId', 'name', 'slug'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
    },
  },
}
