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
      operationId: 'requestResourceProviderUpsert',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('ResourceProviderRequestAccepted'))
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set': {
    // Adding patch for backwards compatibility with existing code. Should be remove after 30 days.
    patch: {
      summary: 'Set the resources for a provider',
      operationId: 'requestResourceProvidersResourcesPatch',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('ResourceProviderRequestAccepted'))
                 + openapi.badRequestResponse()
                 + openapi.notFoundResponse(),
    },

    put: {
      summary: 'Set the resources for a provider',
      operationId: 'requestResourceProvidersResources',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('ResourceProviderRequestAccepted'))
                 + openapi.badRequestResponse()
                 + openapi.notFoundResponse(),
    },
  },
}
