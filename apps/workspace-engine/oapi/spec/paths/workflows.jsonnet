local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflows/{workflowId}/runs': {
    post: {
      summary: 'Create a workflow run',
      operationId: 'createWorkflowRun',
      description: 'Creates a new run for the specified workflow with the provided inputs.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.workflowIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['inputs'],
              properties: {
                inputs: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'Input values for the workflow run.',
                },
              },
            },
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('WorkflowRun'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
