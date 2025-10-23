local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/environments': {
    get: {
      summary: 'List environments',
      operationId: 'listEnvironments',
      description: 'Returns a list of environments for a workspace.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.offsetParam(),
        openapi.limitParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Environment'), 'A list of environments')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/environments/{environmentId}': {
    get: {
      summary: 'Get environment',
      operationId: 'getEnvironment',
      description: 'Returns a specific environment by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.okResponse(
                   openapi.schemaRef('Environment'),
                   'The requested environment'
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
