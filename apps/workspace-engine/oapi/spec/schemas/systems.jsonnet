local openapi = import '../lib/openapi.libsonnet';

{
  System: {
    type: 'object',
    required: ['id', 'workspaceId', 'name'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  SystemDeploymentLink: {
    type: 'object',
    required: ['systemId', 'deploymentId'],
    properties: {
      systemId: { type: 'string' },
      deploymentId: { type: 'string' },
    },
  },

  SystemEnvironmentLink: {
    type: 'object',
    required: ['systemId', 'environmentId'],
    properties: {
      systemId: { type: 'string' },
      environmentId: { type: 'string' },
    },
  },
}
