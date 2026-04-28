local openapi = import '../lib/openapi.libsonnet';

{
  Deployment: {
    type: 'object',
    required: ['id', 'name', 'slug', 'jobAgentSelector', 'jobAgentConfig', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentSelector: { type: 'string', description: 'CEL expression to match job agents' },
      jobAgentConfig: openapi.schemaRef('JobAgentConfig'),
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the deployment should be used' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentDependency: {
    type: 'object',
    required: ['versionSelector'],
    properties: {
      versionSelector: {
        type: 'string',
        description: "CEL expression evaluated against the dependency deployment's current release version on the same resource.",
      },
    },
  },


  DeploymentWithVariablesAndSystems: {
    type: 'object',
    required: ['deployment', 'variables', 'systems'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      variables: { type: 'array', items: openapi.schemaRef('DeploymentVariableWithValues') },
      systems: { type: 'array', items: openapi.schemaRef('System') },
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
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the deployment variable value should be used' },
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
