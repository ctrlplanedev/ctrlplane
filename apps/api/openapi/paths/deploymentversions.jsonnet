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
  },
}
