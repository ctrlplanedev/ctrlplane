local openapi = import '../lib/openapi.libsonnet';

{
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
