local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/job-agents': {
    post: {
      summary: 'Create a new job agent',
      operationId: 'createJobAgent',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateJobAgentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('JobAgent')),
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
      summary: 'Update a job agent',
      operationId: 'updateJobAgent',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.jobAgentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpdateJobAgentRequest'),
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('JobAgent')),
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