local openapi = import '../lib/openapi.libsonnet';

{
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

  DeploymentVariableWithValues: {
    type: 'object',
    required: ['variable', 'values'],
    properties: {
      variable: openapi.schemaRef('DeploymentVariable'),
      values: { type: 'array', items: openapi.schemaRef('DeploymentVariableValue') },
    },
  },

  UpsertDeploymentVariableRequest: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string' },
      description: { type: 'string' },
      defaultValue: openapi.schemaRef('LiteralValue'),
    },
  },

  UpsertDeploymentVariableValueRequest: {
    type: 'object',
    required: ['priority', 'value'],
    properties: {
      priority: { type: 'integer', format: 'int64' },
      resourceSelector: openapi.schemaRef('Selector'),
      value: openapi.schemaRef('Value'),
    },
  },
}

