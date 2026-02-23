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

  DeploymentVariableRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },

  DeploymentVariableValueRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },

  UpsertDeploymentVariableRequest: {
    type: 'object',
    required: ['deploymentId', 'key'],
    properties: {
      deploymentId: { type: 'string' },
      key: { type: 'string' },
      description: { type: 'string' },
      defaultValue: openapi.schemaRef('LiteralValue'),
    },
  },

  UpsertDeploymentVariableValueRequest: {
    type: 'object',
    required: ['deploymentVariableId', 'priority', 'value'],
    properties: {
      deploymentVariableId: { type: 'string' },
      priority: { type: 'integer', format: 'int64' },
      resourceSelector: openapi.schemaRef('Selector'),
      value: openapi.schemaRef('Value'),
    },
  },
}


