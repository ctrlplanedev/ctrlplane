local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/environments/{environmentId}/resources': {
    get: {
      summary: 'Get resources for an environment',
      operationId: 'getEnvironmentResources',
      description: 'Returns a list of resources for environment {environmentId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.okResponse(
        'A list of resources',
        {
          type: 'object',
          properties: {
            resources: {
              type: 'array',
              items: openapi.schemaRef('Resource'),
            },
          },
        }
      ) + openapi.notFoundResponse(),
    },
  },
  
  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/resources': {
    get: {
      summary: 'Get resources for a deployment',
      operationId: 'getDeploymentResources',
      description: 'Returns a list of resources for deployment {deploymentId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse(
        'A list of resources',
        {
          type: 'object',
          properties: {
            resources: {
              type: 'array',
              items: openapi.schemaRef('Resource'),
            },
          },
        }
      ) + openapi.notFoundResponse(),
    },
  },
}

