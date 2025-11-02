local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables': {
    get: {
      summary: 'List deployment variables',
      operationId: 'listDeploymentVariables',
      description: 'Returns a list of variables for a deployment, including their configured values.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentVariableWithValues')),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}': {
    get: {
      summary: 'Get deployment variable',
      operationId: 'getDeploymentVariable',
      description: 'Returns a specific deployment variable by ID, including its configured values.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentVariableWithValues'), 'The requested deployment variable')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert deployment variable',
      operationId: 'upsertDeploymentVariable',
      description: 'Creates or updates a deployment variable by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertDeploymentVariableRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentVariable')),
    },
    delete: {
      summary: 'Delete deployment variable',
      operationId: 'deleteDeploymentVariable',
      description: 'Deletes a deployment variable by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentVariable')),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}/values': {
    get: {
      summary: 'List deployment variable values',
      operationId: 'listDeploymentVariableValues',
      description: 'Returns a list of value overrides for a specific deployment variable.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentVariableValue')),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}/values/{valueId}': {
    get: {
      summary: 'Get deployment variable value',
      operationId: 'getDeploymentVariableValue',
      description: 'Returns a specific variable value override by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
        openapi.stringParam('valueId', 'ID of the variable value'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentVariableValue'), 'The requested variable value')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert deployment variable value',
      operationId: 'upsertDeploymentVariableValue',
      description: 'Creates or updates a variable value override by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
        openapi.stringParam('valueId', 'ID of the variable value'),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertDeploymentVariableValueRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentVariableValue')),
    },
    delete: {
      summary: 'Delete deployment variable value',
      operationId: 'deleteDeploymentVariableValue',
      description: 'Deletes a variable value override by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('variableId', 'ID of the deployment variable'),
        openapi.stringParam('valueId', 'ID of the variable value'),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentVariableValue')),
    },
  },
}

