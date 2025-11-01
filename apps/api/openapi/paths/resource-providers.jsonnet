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
    // Adding patch for backwards compatibility with existing code. Should be remove after 30 days.
    patch: {
      summary: 'Set the resources for a provider',
      operationId: 'setResourceProvidersResourcesPatch',
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
              required: ['resources'],
              properties: {
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
              required: ['resources'],
              properties: {
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
