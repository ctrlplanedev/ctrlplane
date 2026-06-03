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
      operationId: 'requestJobAgentUpsert',
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
  '/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs': {
    get: {
      summary: 'List jobs for a job agent',
      operationId: 'listJobAgentJobs',
      description: 'Returns the jobs assigned to a job agent, optionally filtered by status.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
        {
          name: 'status',
          'in': 'query',
          required: false,
          description: 'Filter jobs by status',
          schema: openapi.schemaRef('JobStatus'),
        },
        {
          name: 'includeDispatchContext',
          'in': 'query',
          required: false,
          description: 'Include the dispatch context on each job. It can be large, so it is omitted by default.',
          schema: { type: 'boolean', default: false },
        },
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Job'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs/{jobId}/claim': {
    post: {
      summary: 'Claim a job',
      operationId: 'claimJob',
      description: 'Atomically claims a queued job for the job agent, transitioning it to in progress. Returns 409 if the job is no longer available to claim.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
        openapi.jobIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Job'), 'Job claimed')
                 + openapi.conflictResponse('Job is not available to claim')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}