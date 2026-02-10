local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflow-templates': {
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
}