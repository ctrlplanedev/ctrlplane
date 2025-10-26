local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/resource-providers': {
    parameters: [
      {
        name: 'workspaceId',
        'in': 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
  },
  '/v1/workspaces/{workspaceId}/resource-providers/{providerId}': {
    parameters: [
      {
        name: 'workspaceId',
        'in': 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
  },
  '/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set': {
    put: {
      summary: 'Set the resources for a provider',
      operationId: 'setResourceProvidersResources',
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
