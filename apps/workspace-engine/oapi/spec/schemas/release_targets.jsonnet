local openapi = import '../lib/openapi.libsonnet';

{
  ReleaseTargetItem: {
    type: 'object',
    required: ['releaseTarget', 'environment', 'resource'],
    properties: {
      releaseTarget: {
        type: 'object',
        required: ['resourceId', 'environmentId', 'deploymentId'],
        properties: {
          resourceId: { type: 'string' },
          environmentId: { type: 'string' },
          deploymentId: { type: 'string' },
        },
      },
      environment: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
      resource: {
        type: 'object',
        required: ['id', 'name', 'version', 'kind', 'identifier'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'string' },
          kind: { type: 'string' },
          identifier: { type: 'string' },
        },
      },
      desiredVersion: {
        nullable: true,
        type: 'object',
        required: ['id', 'name', 'tag'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tag: { type: 'string' },
        },
      },
      currentVersion: {
        nullable: true,
        type: 'object',
        required: ['id', 'name', 'tag'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tag: { type: 'string' },
        },
      },
      latestJob: {
        nullable: true,
        type: 'object',
        required: ['id', 'status', 'createdAt', 'metadata', 'verifications'],
        properties: {
          id: { type: 'string' },
          status: openapi.schemaRef('JobStatus'),
          message: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          metadata: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          verifications: {
            type: 'array',
            items: openapi.schemaRef('JobVerification'),
          },
        },
      },
    },
  },
}
