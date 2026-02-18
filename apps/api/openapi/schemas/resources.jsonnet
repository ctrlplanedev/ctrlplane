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

  ResourceRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },
}
