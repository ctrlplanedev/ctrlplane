local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/job-agents': {
    get: {
      summary: 'List job agents',
      operationId: 'listJobAgents',
      description: 'Returns a list of job agents.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('JobAgent'))
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}': {
    get: {
      summary: 'Get a job agent',
      operationId: 'getJobAgent',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('JobAgent')),
    },
    put: {
      summary: 'Upsert a job agent',
      operationId: 'requestJobAgentUpdate',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertJobAgentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('JobAgentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete a job agent',
      operationId: 'requestJobAgentDeletion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('JobAgentRequestAccepted'), 'Job agent deleted')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}