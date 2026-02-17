local openapi = import '../lib/openapi.libsonnet';

{
  Deployment: {
    type: 'object',
    required: ['id', 'name', 'slug', 'jobAgentConfig', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: openapi.schemaRef('JobAgentConfig'),
      jobAgents: { type: 'array', items: openapi.schemaRef('DeploymentJobAgent') },
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentJobAgent: {
    type: 'object',
    required: ['ref', 'config', 'if'],
    properties: {
      ref: { type: 'string' },
      config: openapi.schemaRef('JobAgentConfig'),
      'if': { type: 'string', description: 'CEL expression to determine if the job agent should be used' },
    },
  },

  DeploymentWithVariables: {
    type: 'object',
    required: ['deployment', 'variables'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      variables: { type: 'array', items: openapi.schemaRef('DeploymentVariableWithValues') },
    },
  },

  DeploymentAndSystems: {
    type: 'object',
    required: ['deployment', 'systems'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      systems: { type: 'array', items: openapi.schemaRef('System') },
    },
  },

  DeploymentVariable: {
    type: 'object',
    required: ['id', 'key', 'deploymentId'],
    properties: {
      id: { type: 'string' },
      key: { type: 'string' },
      description: { type: 'string' },
      deploymentId: { type: 'string' },
      defaultValue: openapi.schemaRef('LiteralValue'),
    },
  },

  DeploymentVariableWithValues: {
    type: 'object',
    required: ['variable', 'values'],
    properties: {
      variable: openapi.schemaRef('DeploymentVariable'),
      values: { type: 'array', items: openapi.schemaRef('DeploymentVariableValue') },
    },
  },

  DeploymentVariableValue: {
    type: 'object',
    required: ['id', 'deploymentVariableId', 'priority', 'value'],
    properties: {
      id: { type: 'string' },
      deploymentVariableId: { type: 'string' },
      priority: { type: 'integer', format: 'int64' },
      resourceSelector: openapi.schemaRef('Selector'),
      value: openapi.schemaRef('Value'),
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
      'metadata',
    ],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      tag: { type: 'string' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      jobAgentConfig: openapi.schemaRef('JobAgentConfig'),
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      deploymentId: { type: 'string' },
      status: openapi.schemaRef('DeploymentVersionStatus'),
      message: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
}
