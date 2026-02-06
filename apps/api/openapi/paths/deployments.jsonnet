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
      operationId: 'requestDeploymentCreation',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted')),
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
      operationId: 'requestDeploymentUpdate',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted')),
    },
    delete: {
      summary: 'Delete deployment',
      operationId: 'requestDeploymentDeletion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
