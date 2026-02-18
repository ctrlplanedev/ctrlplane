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

  JobAgent: {
    type: 'object',
    required: ['id', 'workspaceId', 'name', 'type', 'config'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: openapi.schemaRef('JobAgentConfig'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
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

  ReleaseTargetAndState: {
    type: 'object',
    required: ['releaseTarget', 'state'],
    properties: {
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
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

  // --- Lightweight summary types for list endpoints ---

  ResourceSummary: {
    type: 'object',
    required: ['id', 'name', 'kind', 'version', 'identifier'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      kind: { type: 'string' },
      version: { type: 'string' },
      identifier: { type: 'string' },
    },
  },

  EnvironmentSummary: {
    type: 'object',
    required: ['id', 'name'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
    },
  },

  VersionSummary: {
    type: 'object',
    required: ['id', 'tag', 'name'],
    properties: {
      id: { type: 'string' },
      tag: { type: 'string' },
      name: { type: 'string' },
    },
  },

  JobSummary: {
    type: 'object',
    required: ['id', 'status', 'verifications'],
    properties: {
      id: { type: 'string' },
      status: openapi.schemaRef('JobStatus'),
      message: { type: 'string' },
      links: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'External links extracted from job metadata',
      },
      verifications: {
        type: 'array',
        items: openapi.schemaRef('JobVerification'),
      },
    },
  },

  ReleaseTargetSummary: {
    type: 'object',
    required: ['releaseTarget', 'resource', 'environment'],
    properties: {
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
      resource: openapi.schemaRef('ResourceSummary'),
      environment: openapi.schemaRef('EnvironmentSummary'),
      desiredVersion: openapi.schemaRef('VersionSummary'),
      currentVersion: openapi.schemaRef('VersionSummary'),
      latestJob: openapi.schemaRef('JobSummary'),
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
