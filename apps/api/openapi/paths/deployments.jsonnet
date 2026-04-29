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
        openapi.celParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentAndSystems')),
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
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.badRequestResponse()
                 + openapi.conflictResponse('Deployment name already exists in this workspace'),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/name/{name}': {
    get: {
      summary: 'Get deployment by name',
      operationId: 'getDeploymentByName',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.stringParam('name', 'Name of the deployment'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentWithVariablesAndSystems'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
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
      responses: openapi.okResponse(openapi.schemaRef('DeploymentWithVariablesAndSystems')) +
                 openapi.notFoundResponse() +
                 openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert deployment',
      operationId: 'requestDeploymentUpsert',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.badRequestResponse()
                 + openapi.conflictResponse('Deployment name already exists in this workspace'),
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
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/dependencies': {
    get: {
      summary: 'List deployment dependencies',
      description: "Returns the dependency edges declared by this deployment.",
      operationId: 'listDeploymentDependencies',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse({
                   type: 'array',
                   items: openapi.schemaRef('DeploymentDependency'),
                 })
                 + openapi.notFoundResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/dependencies/{dependencyDeploymentId}': {
    put: {
      summary: 'Upsert deployment dependency',
      description: 'Declare or update a version-selector dependency from this deployment to another deployment. Identified by the (deploymentId, dependencyDeploymentId) pair.',
      operationId: 'requestDeploymentDependencyUpsert',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('dependencyDeploymentId', 'ID of the dependency deployment'),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertDeploymentDependencyRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete deployment dependency',
      operationId: 'requestDeploymentDependencyDeletion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('dependencyDeploymentId', 'ID of the dependency deployment'),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('DeploymentRequestAccepted'))
                 + openapi.notFoundResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/plan': {
    post: {
      summary: 'Create a deployment plan',
      description: 'Compute a dry-run plan showing rendered diffs for each release target without creating a version.',
      operationId: 'createDeploymentPlan',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateDeploymentPlanRequest'),
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('DeploymentPlan'))
                 + openapi.acceptedResponse(openapi.schemaRef('DeploymentPlan'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/plan/{planId}': {
    get: {
      summary: 'Get deployment plan',
      description: 'Retrieve the status and results of a previously created deployment plan.',
      operationId: 'getDeploymentPlan',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.stringParam('planId', 'ID of the deployment plan'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('DeploymentPlan'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
