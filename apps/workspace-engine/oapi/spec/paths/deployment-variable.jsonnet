local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployment-variables/{variableId}': {
    get: {
      summary: 'Get deployment variable',
      operationId: 'getDeploymentVariable',
      description: 'Returns a specific deployment variable by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentVariable'), 'The requested deployment variable')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}': {
    get: {
      summary: 'Get deployment variable value',
      operationId: 'getDeploymentVariableValue',
      description: 'Returns a specific deployment variable value by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.stringParam('valueId', 'ID of the deployment variable value'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentVariableValue'), 'The requested deployment variable value')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
