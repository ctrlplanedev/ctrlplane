local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/workflow-templates': {
    post: {
      tags: ['Workflows'],
      summary: 'Create a workflow template from a YAML definition',
      operationId: 'createWorkflowTemplateFromYaml',
      description: 'Creates a workflow template from a YAML definition.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['yaml'],
              properties: {
                yaml: {
                  type: 'string',
                  description: 'The workflow definition in YAML format',
                },
              },
            },
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('WorkflowTemplate')) +
                 openapi.badRequestResponse(),
    },
  },
}