local openapi = import '../lib/openapi.libsonnet';

local jobAgentConfig = {
  type: 'object',
  additionalProperties: true,
};

{
  CreateDeploymentRequest: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  UpsertDeploymentRequest: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },

  Deployment: {
    type: 'object',
    required: ['id', 'name', 'slug', 'jobAgentConfig'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
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

  DeploymentWithVariables: {
    type: 'object',
    required: ['deployment', 'variables'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      variables: { type: 'array', items: openapi.schemaRef('DeploymentVariableWithValues') },
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
}
