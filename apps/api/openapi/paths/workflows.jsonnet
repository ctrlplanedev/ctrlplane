local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflows': {
    get: {
      tags: ['Workflows'],
      summary: 'List workflows',
      operationId: 'listWorkflows',
      description: 'Returns a list of workflows.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Workflow'))
                 + openapi.badRequestResponse(),
    },
    post: {
      tags: ['Workflows'],
      summary: 'Create a workflow',
      operationId: 'createWorkflow',
      description: 'Creates a workflow.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateWorkflow'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Workflow')) +
                 openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/workflows/{workflowId}': {
    get: {
      tags: ['Workflows'],
      summary: 'Get a workflow',
      operationId: 'getWorkflow',
      description: 'Gets a workflow by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Workflow'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      tags: ['Workflows'],
      summary: 'Update a workflow',
      operationId: 'updateWorkflow',
      description: 'Updates a workflow template.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpdateWorkflow'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Workflow'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      tags: ['Workflows'],
      summary: 'Delete a workflow',
      operationId: 'deleteWorkflow',
      description: 'Deletes a workflow.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('Workflow'), 'Workflow deleted')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
