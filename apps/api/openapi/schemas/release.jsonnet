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

  ReleaseTargetStateResponse: {
    type: 'object',
    properties: {
      desiredRelease: openapi.schemaRef('Release'),
      currentRelease: openapi.schemaRef('Release'),
      latestJob: {
        type: 'object',
        required: ['job', 'verifications'],
        properties: {
          job: openapi.schemaRef('Job'),
          verifications: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'jobId', 'metrics', 'createdAt', 'status'],
              properties: {
                id: { type: 'string' },
                jobId: { type: 'string' },
                metrics: {
                  type: 'array',
                  items: openapi.schemaRef('VerificationMetricStatus'),
                },
                message: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                status: {
                  type: 'string',
                  enum: ['passed', 'running', 'failed'],
                  description: 'Computed aggregate status of this verification',
                },
              },
            },
          },
        },
      },
    },
  },
}
