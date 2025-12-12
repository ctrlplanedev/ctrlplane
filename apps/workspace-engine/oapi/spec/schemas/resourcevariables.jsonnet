local openapi = import '../lib/openapi.libsonnet';

{
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
