local openapi = import '../lib/openapi.libsonnet';

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
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
      },
      resourceSelector: openapi.schemaRef('Selector'),
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
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
      },
      resourceSelector: openapi.schemaRef('Selector'),
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
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
      },
      resourceSelector: openapi.schemaRef('Selector'),
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
  GetDeploymentResponse: {
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
