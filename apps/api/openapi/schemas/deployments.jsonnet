local openapi = import '../lib/openapi.libsonnet';

local jobAgentConfig = {
  type: 'object',
  additionalProperties: true,
};

{
  CreateDeploymentRequest: {
    type: 'object',
    required: ['systemId', 'slug', 'name'],
    properties: {
      systemId: { type: 'string' },
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
    required: ['systemId', 'slug', 'name'],
    properties: {
      systemId: { type: 'string' },
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
    required: ['id', 'name', 'slug', 'systemId', 'jobAgentConfig'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      systemId: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      resourceSelector: openapi.schemaRef('Selector'),
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentAndSystem: {
    type: 'object',
    required: ['deployment', 'system'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      system: openapi.schemaRef('System'),
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
