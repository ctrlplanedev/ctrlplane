local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployments': {
    get: {
      summary: 'List deployments',
      operationId: 'listDeployments',
      description: 'Returns a paginated list of deployments for a workspace.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(
        {
          type: 'array',
          items: openapi.schemaRef('Deployment'),
        }
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}': {
    get: {
      summary: 'Get deployment',
      operationId: 'getDeployment',
      description: 'Returns a specific deployment by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Deployment'), 'The requested deployment')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/release-targets': {
    get: {
      summary: 'Get release targets for a deployment',
      operationId: 'getReleaseTargetsForDeployment',
      description: 'Returns a list of release targets for a deployment.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('ReleaseTarget'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions': {
    get: {
      summary: 'Get versions for a deployment',
      operationId: 'getVersionsForDeployment',
      description: 'Returns a list of releases for a deployment.',
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
