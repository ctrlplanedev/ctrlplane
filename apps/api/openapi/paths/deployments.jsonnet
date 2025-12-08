local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployments': {
    get: {
      summary: 'List deployments',
      operationId: 'listDeployments',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentAndSystem')),
    },
    post: {
      summary: 'Create deployment',
      operationId: 'createDeployment',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateDeploymentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Deployment')),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}': {
    get: {
      summary: 'Get deployment',
      operationId: 'getDeployment',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentWithVariables')) +
                 openapi.notFoundResponse() +
                 openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert deployment',
      operationId: 'upsertDeployment',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertDeploymentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Deployment')),
    },
    delete: {
      summary: 'Delete deployment',
      operationId: 'deleteDeployment',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('Deployment')),
    },
  },
}
