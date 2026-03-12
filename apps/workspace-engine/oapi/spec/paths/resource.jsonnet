local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/resources/aggregates': {
    post: {
      summary: 'Compute resource aggregate',
      operationId: 'computeAggergate',
      description: 'Filters resources by a CEL expression and groups them by specified properties, returning counts per group.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description: 'CEL expression to filter resources. Defaults to "true" (all resources).',
                },
                groupBy: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'property'],
                    properties: {
                      name: { type: 'string', description: 'Label for this grouping' },
                      property: { type: 'string', description: 'Dot-path property to group by (e.g. kind, metadata.region)' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: openapi.okResponse({
        type: 'object',
        properties: {
          total: { type: 'integer', description: 'Total number of matching resources' },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description: 'Map of grouping name to its value for this bucket',
                },
                count: { type: 'integer', description: 'Number of resources in this group' },
              },
              required: ['key', 'count'],
            },
          },
        },
        required: ['total', 'groups'],
      }) + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/resources/query': {
    post: {
      summary: 'Query resources with CEL expression',
      operationId: 'queryResources',
      description: 'Returns paginated resources that match the provided CEL expression. Use the "resource" variable in your expression to access resource properties.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description: 'CEL expression to filter resources. Defaults to "true" (all resources).',
                },
              },
            },
          },
        },
      },
      responses: openapi.paginatedResponse(openapi.schemaRef('Resource'))
                 + openapi.badRequestResponse(),
    },
  },
}
