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
      responses: openapi.okResponse(
        openapi.schemaRef('ResourceProvider'),
      ),
    },
  },
  '/v1/workspaces/{workspaceId}/resource-providers': {
    put: {
      summary: 'Upsert resource provider',
      operationId: 'upsertResourceProvider',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertResourceProviderRequest'),
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('ResourceProvider')),
    },
  },
  '/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set': {
    put: {
      summary: 'Set the resources for a provider',
      operationId: 'setResourceProvidersResources',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.providerIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['batchId', 'resources'],
              properties: {
                batchId: {
                  type: 'string',
                  description: 'The ID of the batch to use',
                },
                resources: {
                  type: 'array',
                  items: openapi.schemaRef('ResourceProviderResource'),
                },
              },
            },
          },
        },
      },
      responses: openapi.acceptedResponse(
        { type: 'object', properties: {} },
      ),
    },
  },
}
