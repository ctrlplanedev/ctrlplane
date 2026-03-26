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
      environment: openapi.schemaRef('Environment'),
      resource: openapi.schemaRef('Resource'),
      desiredVersion: openapi.schemaRef('DeploymentVersion', nullable=true),
      currentVersion: openapi.schemaRef('DeploymentVersion', nullable=true),
      latestJob: {
        nullable: true,
        type: 'object',
        required: ['id', 'status', 'createdAt', 'metadata', 'verifications'],
        properties: {
          id: { type: 'string' },
          status: openapi.schemaRef('JobStatus'),
          message: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
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
