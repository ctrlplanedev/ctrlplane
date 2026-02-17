local openapi = import '../lib/openapi.libsonnet';

{
  GlobalVariable: {
    type: 'object',
    required: ['id', 'workspaceId', 'key'],
    properties: {
      id: { type: 'string' },
      workspaceId: { type: 'string' },
      key: { type: 'string' },
      description: { type: 'string' },
    },
  },

  GlobalVariableScope: {
    type: 'object',
    properties: {
      systemId: { type: 'string' },
      environmentId: { type: 'string' },
      deploymentId: { type: 'string' },
      resourceId: { type: 'string' },
      resourceSelector: openapi.schemaRef('Selector'),
    },
  },

  GlobalVariableValue: {
    type: 'object',
    required: ['id', 'globalVariableId', 'priority', 'value'],
    properties: {
      id: { type: 'string' },
      globalVariableId: { type: 'string' },
      priority: { type: 'integer', format: 'int64' },
      scope: openapi.schemaRef('GlobalVariableScope'),
      value: openapi.schemaRef('LiteralValue'),
    },
  },

  GlobalVariableWithValues: {
    type: 'object',
    required: ['variable', 'values'],
    properties: {
      variable: openapi.schemaRef('GlobalVariable'),
      values: { type: 'array', items: openapi.schemaRef('GlobalVariableValue') },
    },
  },
}
