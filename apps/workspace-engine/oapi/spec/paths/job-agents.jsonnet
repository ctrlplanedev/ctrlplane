local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/job-agents': {
    get: {
      summary: 'Get job agents',
      operationId: 'getJobAgents',
      description: 'Returns a list of job agents.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('JobAgent'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}': {
    get: {
      summary: 'Get job agent',
      operationId: 'getJobAgent',
      description: 'Returns a specific job agent by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
      ],
    },
    responses: openapi.okResponse(openapi.schemaRef('JobAgent'), 'The requested job agent')
               + openapi.notFoundResponse()
               + openapi.badRequestResponse(),
  },
  '/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs': {
    get: {
      summary: 'Get jobs for a job agent',
      operationId: 'getJobsForJobAgent',
      description: 'Returns a list of jobs for a job agent.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
    },
    responses: openapi.paginatedResponse(openapi.schemaRef('Job'))
               + openapi.notFoundResponse()
               + openapi.badRequestResponse(),
  },
}
