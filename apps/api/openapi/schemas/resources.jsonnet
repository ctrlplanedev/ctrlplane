local openapi = import '../lib/openapi.libsonnet';

{
  Resource: {
    type: 'object',
    required: [
      'name',
      'version',
      'kind',
      'identifier',
      'createdAt',
      'workspaceId',
      'config',
      'metadata',
    ],
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      kind: { type: 'string' },
      identifier: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      workspaceId: { type: 'string' },
      providerId: { type: 'string' },
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
  ResourceVariable: {
    type: 'object',
    required: ['resourceId', 'key', 'value'],
    properties: {
      resourceId: { type: 'string' },
      key: { type: 'string' },
      value: openapi.schemaRef('Value'),
    },
  },

  ResourcePreviewRequest: {
    type: 'object',
    required: ['name', 'version', 'kind', 'identifier', 'config', 'metadata'],
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      kind: { type: 'string' },
      identifier: { type: 'string' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },

  ReleaseTargetPreview: {
    type: 'object',
    required: ['system', 'deployment', 'environment'],
    properties: {
      system: openapi.schemaRef('System'),
      deployment: openapi.schemaRef('Deployment'),
      environment: openapi.schemaRef('Environment'),
    },
  },

  UpsertResourceRequest: {
    type: 'object',
    required: ['name', 'version', 'kind'],
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      kind: { type: 'string' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      variables: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },

  ResourceRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },

  ListResourcesFilters: {
    type: 'object',
    properties: {
      providerIds: { type: 'array', items: { type: 'string' } },
      versions: { type: 'array', items: { type: 'string' } },
      identifiers: { type: 'array', items: { type: 'string' } },
      query: { type: 'string', description: 'Text search on name or identifier' },
      kinds: {
        type: 'array',
        items: { type: 'string' },
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        default: 500,
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Exact metadata key/value matches',
      },
      sortBy: {
        type: 'string',
        enum: ['createdAt', 'updatedAt', 'name', 'kind'],
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'asc',
      },
    },
  },
}
