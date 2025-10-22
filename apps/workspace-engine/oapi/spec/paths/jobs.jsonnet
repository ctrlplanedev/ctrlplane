local openapi = import '../lib/openapi.libsonnet';

{
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
}
