local openapi = import '../lib/openapi.libsonnet';

{
  DeploymentVersionStatus: {
    type: 'string',
    enum: ['unspecified', 'building', 'ready', 'failed', 'rejected'],
  },
  UpsertDeploymentVersionRequest: {
    type: 'object',
    required: ['tag', 'deploymentId'],
    properties: {
      config: {
        type: 'object',
        additionalProperties: true,
      },
      deploymentId: { type: 'string' },
      jobAgentConfig: { type: 'object', additionalProperties: true },
      status: openapi.schemaRef('DeploymentVersionStatus'),
      name: { type: 'string' },
      tag: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },
  DeploymentVersion: {
    type: 'object',
    required: [
      'id',
      'name',
      'tag',
      'config',
      'jobAgentConfig',
      'deploymentId',
      'status',
      'createdAt',
    ],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      tag: { type: 'string' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
      },
      deploymentId: { type: 'string' },
      status: openapi.schemaRef('DeploymentVersionStatus'),
      message: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },
}
