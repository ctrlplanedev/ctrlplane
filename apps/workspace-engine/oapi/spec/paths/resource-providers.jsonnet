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
}
