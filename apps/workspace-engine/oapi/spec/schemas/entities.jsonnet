local openapi = import '../lib/openapi.libsonnet';

{
  Resource: {
    type: 'object',
    required: [
      'id',
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
      id: { type: 'string' },
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

  ResourceProvider: {
    type: 'object',
    required: ['id', 'workspaceId', 'name', 'createdAt', 'metadata'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
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

  Environment: {
    type: 'object',
    required: ['id', 'name', 'systemId', 'createdAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      systemId: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  System: {
    type: 'object',
    required: ['id', 'workspaceId', 'name'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
  },

  JobAgent: {
    type: 'object',
    required: ['id', 'workspaceId', 'name', 'type', 'config'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: openapi.schemaRef('JobAgentConfig'),
    },
  },

  JobAgentConfig: {
    type: 'object',
    additionalProperties: true,
  },

  ReleaseTarget: {
    type: 'object',
    required: ['resourceId', 'environmentId', 'deploymentId'],
    properties: {
      resourceId: { type: 'string' },
      environmentId: { type: 'string' },
      deploymentId: { type: 'string' },
    },
  },

  ReleaseTargetState: {
    type: 'object',
    properties: {
      desiredRelease: openapi.schemaRef('Release'),
      currentRelease: openapi.schemaRef('Release'),
      latestJob: openapi.schemaRef('JobWithVerifications'),
    },
  },

  ReleaseTargetWithState: {
    type: 'object',
    required: ['releaseTarget', 'state', 'environment', 'resource', 'deployment'],
    properties: {
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
      environment: openapi.schemaRef('Environment'),
      resource: openapi.schemaRef('Resource'),
      deployment: openapi.schemaRef('Deployment'),
      state: openapi.schemaRef('ReleaseTargetState'),
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

  GithubEntity: {
    type: 'object',
    required: ['installationId', 'slug'],
    properties: {
      installationId: { type: 'integer' },
      slug: { type: 'string' },
    },
  },

  RelatableEntity: {
    oneOf: [
      openapi.schemaRef('Deployment'),
      openapi.schemaRef('Environment'),
      openapi.schemaRef('Resource'),
    ],
  },
}
