local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/systems/{systemId}': {
    get: {
      summary: 'Get system',
      operationId: 'getSystem',
      description: 'Returns a specific system by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('System'), 'The requested system')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
