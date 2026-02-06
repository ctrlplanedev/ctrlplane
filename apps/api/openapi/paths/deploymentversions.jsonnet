local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions': {
    get: {
      summary: 'List deployment versions',
      operationId: 'listDeploymentVersions',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentVersion'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    post: {
      summary: 'Create a deployment version',
      operationId: 'createDeploymentVersion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateDeploymentVersionRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentVersion'))
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}': {
    patch: {
      summary: 'Update deployment version',
      operationId: 'requestDeploymentVersionUpdate',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentVersionIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpdateDeploymentVersionRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentVersion'))
                 + openapi.badRequestResponse(),
    },
  },
}
