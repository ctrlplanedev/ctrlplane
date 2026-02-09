local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/releases/{releaseId}': {
    get: {
      summary: 'Get release',
      operationId: 'getRelease',
      description: 'Returns a specific release by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Release'), 'The requested release')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
