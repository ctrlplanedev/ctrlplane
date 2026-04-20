local openapi = import '../lib/openapi.libsonnet';

{
  ResourceVariable: {
    type: 'object',
    required: ['resourceId', 'key', 'value', 'priority'],
    properties: {
      resourceId: { type: 'string' },
      key: { type: 'string' },
      value: openapi.schemaRef('Value'),
      priority: { type: 'integer', format: 'int64' },
      resourceSelector: { type: 'string', description: 'A CEL expression to select which resources this value applies to' },
    },
  },

  ResourceVariablesBulkUpdateEvent: {
    type: 'object',
    required: ['resourceId', 'variables'],
    properties: {
      resourceId: { type: 'string' },
      variables: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
}
