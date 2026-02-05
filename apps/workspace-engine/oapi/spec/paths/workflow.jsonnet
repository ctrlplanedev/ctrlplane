local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflow-templates': {
    get: {
      summary: 'Get all workflow templates',
      operationId: 'getWorkflowTemplates',
      description: 'Gets all workflow templates for a workspace.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('WorkflowTemplate'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}': {
    get: {
      summary: 'Get a workflow template',
      operationId: 'getWorkflowTemplate',
      description: 'Gets a workflow template.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowTemplateIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('WorkflowTemplate'), 'Get workflow template')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}/workflows': {
    get: {
      summary: 'Get all workflows for a workflow template',
      operationId: 'getWorkflowsByTemplate',
      description: 'Gets all workflows for a workflow template.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowTemplateIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('WorkflowWithJobs'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
