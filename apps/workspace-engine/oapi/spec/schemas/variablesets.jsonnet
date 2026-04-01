local openapi = import '../lib/openapi.libsonnet';

{
  VariableSet: {
    type: 'object',
    required: ['id', 'name', 'description', 'selector', 'priority', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', description: 'The name of the variable set' },
      description: { type: 'string', description: 'The description of the variable set' },
      selector: { type: 'string', description: 'A CEL expression to select which resources this value applies to' },
      priority: { type: 'integer', format: 'int64', description: 'The priority of the variable set' },
      createdAt: { type: 'string', format: 'date-time', description: 'The timestamp when the variable set was created' },
      updatedAt: { type: 'string', format: 'date-time', description: 'The timestamp when the variable set was last updated' },
    },
  },

  VariableSetVariable: {
    type: 'object',
    required: ['id', 'variableSetId', 'key', 'value'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'The ID of the variable' },
      variableSetId: { type: 'string', format: 'uuid', description: 'The ID of the variable set this variable belongs to' },
      key: { type: 'string', description: 'The key of the variable, unique within the variable set' },
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
}
