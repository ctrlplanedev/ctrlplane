local openapi = import '../lib/openapi.libsonnet';

{
  UpsertResourceProviderRequest: {
    type: 'object',
    required: ['id', 'name', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Arbitrary metadata for the resource provider (record<string, string>)',
      },
    },
  },

  ResourceProviderResource: {
    type: 'object',
    required: [
      'name',
      'version',
      'kind',
      'identifier',
      'createdAt',
      'config',
      'metadata',
    ],
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      kind: { type: 'string' },
      identifier: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      lockedAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },

  ResourceProvider: {
    type: 'object',
    required: ['id', 'workspaceId', 'name', 'createdAt', 'metadata'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },
}

