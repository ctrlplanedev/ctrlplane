local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflow-templates': {
    get: {
      tags: ['Workflows'],
      summary: 'List workflow templates',
      operationId: 'listWorkflowTemplates',
      description: 'Returns a list of workflow templates.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('WorkflowTemplate'))
                 + openapi.badRequestResponse(),
    },
    post: {
      tags: ['Workflows'],
      summary: 'Create a workflow template',
      operationId: 'createWorkflowTemplate',
      description: 'Creates a workflow template.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateWorkflowTemplate'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('WorkflowTemplate')) +
                 openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}': {
    get: {
      tags: ['Workflows'],
      summary: 'Get a workflow template',
      operationId: 'getWorkflowTemplate',
      description: 'Gets a workflow template by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowTemplateIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('WorkflowTemplate'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      tags: ['Workflows'],
      summary: 'Update a workflow template',
      operationId: 'updateWorkflowTemplate',
      description: 'Updates a workflow template.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowTemplateIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpdateWorkflowTemplate'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('WorkflowTemplate'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      tags: ['Workflows'],
      summary: 'Delete a workflow template',
      operationId: 'deleteWorkflowTemplate',
      description: 'Deletes a workflow template.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowTemplateIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('WorkflowTemplate'), 'Workflow template deleted')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
