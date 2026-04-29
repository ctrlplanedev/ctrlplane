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
        openapi.orderParam(),
        openapi.celParam(),
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
  '/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/dependencies': {
    get: {
      summary: 'List deployment-version dependencies',
      description: "Returns the dependency edges declared by this deployment version.",
      operationId: 'listDeploymentVersionDependencies',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentVersionIdParam(),
      ],
      responses: openapi.okResponse({
                   type: 'array',
                   items: openapi.schemaRef('DeploymentVersionDependency'),
                 })
                 + openapi.notFoundResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}': {
    put: {
      summary: 'Upsert deployment-version dependency',
      description: 'Declare or update a version-selector dependency from this deployment version to another deployment. Identified by the (deploymentVersionId, dependencyDeploymentId) pair.',
      operationId: 'requestDeploymentVersionDependencyUpsert',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentVersionIdParam(),
        openapi.stringParam('dependencyDeploymentId', 'ID of the dependency deployment'),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertDeploymentVersionDependencyRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete deployment-version dependency',
      operationId: 'requestDeploymentVersionDependencyDeletion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentVersionIdParam(),
        openapi.stringParam('dependencyDeploymentId', 'ID of the dependency deployment'),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
