local openapi = import '../lib/openapi.libsonnet';

{
  VariableSet: {
    type: 'object',
    required: ['id', 'name', 'description', 'selector', 'priority', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string' },
      selector: { type: 'string', description: 'A CEL expression to select which release targets this variable set applies to' },
      priority: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  VariableSetVariable: {
    type: 'object',
    required: ['key', 'value'],
    properties: {
      key: { type: 'string' },
      value: openapi.schemaRef('Value'),
    },
  },

  VariableSetWithVariables: {
    allOf: [
      openapi.schemaRef('VariableSet'),
      {
        type: 'object',
        required: ['variables'],
        properties: {
          variables: { type: 'array', items: openapi.schemaRef('VariableSetVariable') },
        },
      },
    ],
  },

  CreateVariableSet: {
    type: 'object',
    required: ['name', 'selector', 'variables'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      selector: { type: 'string', description: 'A CEL expression to select which release targets this variable set applies to' },
      priority: { type: 'integer' },
      variables: { type: 'array', items: openapi.schemaRef('VariableSetVariable') },
    },
  },

  UpdateVariableSet: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      selector: { type: 'string' },
      priority: { type: 'integer' },
      variables: { type: 'array', items: openapi.schemaRef('VariableSetVariable') },
    },
  },
}
