local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/resource-providers/name/{name}': {
    get: {
      summary: 'Get a resource provider by name',
      operationId: 'getResourceProviderByName',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.nameParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('ResourceProvider')) +
                 openapi.notFoundResponse() +
                 openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/resource-providers': {
    get: {
      summary: 'Get all resource providers',
      operationId: 'getResourceProviders',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('ResourceProvider')),
    },
  },
  '/v1/workspaces/{workspaceId}/resource-providers/cache-batch': {
    post: {
      summary: 'Cache a large resource batch for deferred processing',
      operationId: 'cacheBatch',
      description: 'Stores resources in memory and returns a batch ID. The batch is processed when a corresponding Kafka event is received. Uses Ristretto cache with 5-minute TTL.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['providerId', 'resources'],
              properties: {
                providerId: {
                  type: 'string',
                  description: 'The ID of the resource provider',
                },
                resources: {
                  type: 'array',
                  items: openapi.schemaRef('Resource'),
                  description: 'Array of resources to cache',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Batch cached successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  batchId: {
                    type: 'string',
                    description: 'Unique ID for this cached batch',
                  },
                  resourceCount: {
                    type: 'integer',
                    description: 'Number of resources cached',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
