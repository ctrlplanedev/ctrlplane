local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflows': {
    get: {
      summary: 'List workflows',
      operationId: 'listWorkflows',
      description: 'Returns a list of workflows.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Workflow'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/workflows/{workflowId}': {
    get: {
      summary: 'Get a workflow',
      operationId: 'getWorkflow',
      description: 'Gets a workflow by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Workflow'), 'Get workflow')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/workflows/{workflowId}/runs': {
    get: {
      summary: 'Get all workflow runs for a workflow',
      operationId: 'getWorkflowRuns',
      description: 'Gets all workflow runs for a workflow by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('WorkflowRunWithJobs'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
