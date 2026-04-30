local openapi = import '../lib/openapi.libsonnet';

{
  DeploymentVersionStatus: {
    type: 'string',
    enum: ['unspecified', 'building', 'ready', 'failed', 'rejected'],
  },

  CreateDeploymentVersionRequest: {
    type: 'object',
    required: ['name', 'tag', 'status'],
    properties: {
      config: {
        type: 'object',
        additionalProperties: true,
      },
      jobAgentConfig: { type: 'object', additionalProperties: true },
      status: openapi.schemaRef('DeploymentVersionStatus'),
      name: { type: 'string' },
      tag: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      dependencies: {
        type: 'object',
        description: "Map of dependency deployment ID to a CEL version selector evaluated against that deployment's current release on the same resource. Inserted atomically with the version so reconciliation cannot fire before edges are attached.",
        additionalProperties: {
          type: 'object',
          required: ['versionSelector'],
          properties: {
            versionSelector: {
              type: 'string',
              description: "CEL expression evaluated against the dependency deployment's current release version on the same resource.",
            },
          },
        },
      },
    },
  },

  UpdateDeploymentVersionRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      config: {
        type: 'object',
        additionalProperties: true,
      },
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
