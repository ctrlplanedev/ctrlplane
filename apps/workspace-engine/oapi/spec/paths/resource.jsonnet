local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/environments/{environmentId}/resources': {
    get: {
      summary: 'Get resources for an environment',
      operationId: 'getEnvironmentResources',
      description: 'Returns a paginated list of resources for environment {environmentId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(
        {
          type: 'array',
          items: openapi.schemaRef('Resource'),
        }
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/deployments/{deploymentId}/resources': {
    get: {
      summary: 'Get resources for a deployment',
      operationId: 'getDeploymentResources',
      description: 'Returns a paginated list of resources for deployment {deploymentId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(
        {
          type: 'array',
          items: openapi.schemaRef('Resource'),
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
      description: 'Returns paginated resources that match the provided CEL expression. Use the "resource" variable in your expression to access resource properties.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', properties: { filter: openapi.schemaRef('Selector') } },
          },
        },
      },
      responses: openapi.paginatedResponse(
        {
          type: 'array',
          items: openapi.schemaRef('Resource'),
        }
      ) + openapi.badRequestResponse(),
    },
  },
}
