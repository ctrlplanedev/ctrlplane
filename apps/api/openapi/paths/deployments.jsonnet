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
