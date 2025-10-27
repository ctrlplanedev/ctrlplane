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
      responses: openapi.acceptedResponse(
        openapi.schemaRef('ResourceProvider'),
      ),
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
