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
    put: {
      summary: 'Upsert deployment version',
      operationId: 'upsertDeploymentVersion',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertDeploymentVersionRequest'),
          },
        },
      },
      responses: openapi.createdResponse(openapi.schemaRef('DeploymentVersion'))
                 + openapi.acceptedResponse(openapi.schemaRef('DeploymentVersion'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
