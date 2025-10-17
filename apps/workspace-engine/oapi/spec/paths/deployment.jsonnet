local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}': {
    get: {
      summary: 'Get deployment',
      operationId: 'getDeployment',
      description: 'Returns a specific deployment by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse(
        'The requested deployment',
        openapi.schemaRef('Deployment')
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}
