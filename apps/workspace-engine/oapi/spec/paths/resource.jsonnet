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

  '/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}': {
    get: {
      summary: 'Get resource by identifier',
      operationId: 'getResourceByIdentifier',
      description: 'Returns a specific resource by its identifier.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.resourceIdentifierParam(),
      ],
      responses: openapi.okResponse(
        'The requested resource',
        openapi.schemaRef('Resource')
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/query': {
    post: {
      summary: 'Query resources with CEL expression',
      operationId: 'queryResources',
      description: 'Returns resources that match the provided CEL expression. Use the "resource" variable in your expression to access resource properties.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('Selector'),
          },
        },
      },
      responses: openapi.okResponse(
        'List of matching resources',
        {
          type: 'object',
          properties: {
            resources: {
              type: 'array',
              items: openapi.schemaRef('Resource'),
            },
          },
        }
      ) + openapi.badRequestResponse(),
    },
  },
}
