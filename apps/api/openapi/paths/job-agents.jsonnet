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
      operationId: 'upsertJobAgent',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('JobAgent')),
    },
    delete: {
      summary: 'Delete a job agent',
      operationId: 'deleteJobAgent',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('JobAgent'), 'Job agent deleted')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}