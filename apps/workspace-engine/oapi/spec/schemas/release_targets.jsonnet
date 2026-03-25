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
        allOf: [
          openapi.schemaRef('Job'),
          {
            type: 'object',
            required: ['verifications'],
            properties: {
              verifications: {
                type: 'array',
                items: openapi.schemaRef('JobVerification'),
              },
            },
          },
        ],
      },
    },
  },
}
