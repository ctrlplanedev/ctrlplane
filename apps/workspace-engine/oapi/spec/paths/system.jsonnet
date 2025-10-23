local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/systems': {
    get: {
      summary: 'List systems',
      operationId: 'listSystems',
      description: 'Returns a list of systems for a workspace.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.offsetParam(),
        openapi.limitParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('System'), 'A list of systems')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/systems/{systemId}': {
    get: {
      summary: 'Get system',
      operationId: 'getSystem',
      description: 'Returns a specific system by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      responses: openapi.okResponse(
                   {
                     type: 'object',
                     required: ['system', 'environments', 'deployments'],
                     properties: {
                       system: openapi.schemaRef('System'),
                       environments: {
                         type: 'array',
                         items: openapi.schemaRef('Environment'),
                         description: 'Environments associated with the system',
                       },
                       deployments: {
                         type: 'array',
                         items: openapi.schemaRef('Deployment'),
                         description: 'Deployments associated with the system',
                       },
                     },
                   },
                   'The requested system with its environments and deployments'
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
