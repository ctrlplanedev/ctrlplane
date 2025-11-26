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

  '/v1/workspaces/{workspaceId}/releases/{releaseId}/verifications': {
    get: {
      summary: 'Get release verifications',
      operationId: 'getReleaseVerifications',
      description: 'Returns all verifications for a specific release with their results.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseIdParam(),
      ],
      responses: openapi.okResponse(
                   {
                     type: 'array',
                     items: openapi.schemaRef('ReleaseVerification'),
                   },
                   'List of verifications for the release'
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
