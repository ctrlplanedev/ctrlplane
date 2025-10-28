local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/jobs': {
    get: {
      summary: 'List jobs',
      operationId: 'getJobs',
      description: 'Returns a list of jobs.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('JobWithRelease'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/jobs/{jobId}': {
    get: {
      summary: 'Get job',
      operationId: 'getJob',
      description: 'Returns a specific job by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Job'), 'Get job')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/jobs/{jobId}/with-release': {
    get: {
      summary: 'Get job with release',
      operationId: 'getJobWithRelease',
      description: 'Returns a specific job by ID with its release.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('JobWithRelease'), 'Get job with release')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
