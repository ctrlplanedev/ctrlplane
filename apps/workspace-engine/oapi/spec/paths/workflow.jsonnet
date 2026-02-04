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
}
