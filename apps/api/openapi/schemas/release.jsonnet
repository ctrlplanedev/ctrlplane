local openapi = import '../lib/openapi.libsonnet';


{
  ReleaseTarget: {
    type: 'object',
    required: ['resourceId', 'environmentId', 'deploymentId'],
    properties: {
      resourceId: { type: 'string' },
      environmentId: { type: 'string' },
      deploymentId: { type: 'string' },
    },
  },
  Release: {
    type: 'object',
    required: ['version', 'variables', 'encryptedVariables', 'releaseTarget', 'createdAt'],
    properties: {
      version: openapi.schemaRef('DeploymentVersion'),
      variables: {
        type: 'object',
        additionalProperties: openapi.schemaRef('LiteralValue'),
      },
      encryptedVariables: {
        type: 'array',
        items: { type: 'string' },
      },
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
      createdAt: { type: 'string' },
    },
  },
  ReleaseTargetState: {
    type: 'object',
    properties: {
      desiredRelease: openapi.schemaRef('Release'),
      currentRelease: openapi.schemaRef('Release'),
      latestJob: openapi.schemaRef('Job'),
    },
  },
  ReleaseTargetWithState: {
    type: 'object',
    required: ['releaseTarget', 'state'],
    properties: {
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
      state: openapi.schemaRef('ReleaseTargetState'),
    },
  },
}
