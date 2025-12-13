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
      responses: openapi.paginatedResponse(openapi.schemaRef('Resource'))
                 + openapi.notFoundResponse(),
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
      responses: openapi.paginatedResponse(openapi.schemaRef('Resource'))
                 + openapi.notFoundResponse(),
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
      responses: openapi.okResponse(openapi.schemaRef('Resource'), 'The requested resource')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/relationships': {
    get: {
      summary: 'Get relationships for a resource',
      operationId: 'getRelationshipsForResource',
      description: 'Returns all relationships for the specified resource.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.resourceIdentifierParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: openapi.schemaRef('EntityRelation'),
          },
        },
        'The requested relationships',
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/variables': {
    get: {
      summary: 'Get variables for a resource',
      operationId: 'getVariablesForResource',
      description: 'Returns a list of variables for a resource',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.resourceIdentifierParam(),
      ],
      responses: openapi.okResponse(
                   {
                     type: 'array',
                     items: openapi.schemaRef('ResourceVariable'),
                   },
                   'The requested variables',
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets': {
    get: {
      summary: 'Get release targets for a resource',
      operationId: 'getReleaseTargetsForResource',
      description: 'Returns a list of release targets for a resource.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.resourceIdentifierParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('ReleaseTargetWithState'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets/deployment/{deploymentId}': {
    get: {
      summary: 'Get release target for a resource in a deployment',
      operationId: 'getReleaseTargetsForResourceInDeployment',
      description: 'Returns a release target for a resource in a deployment.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.resourceIdentifierParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('ReleaseTarget'), 'The requested release target')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/kinds': {
    get: {
      summary: 'Get kinds for a workspace',
      operationId: 'getKindsForWorkspace',
      description: 'Returns a list of all resource kinds in a workspace.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'array',
          items: { type: 'string' },
        },
        'The requested kinds',
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
      responses: openapi.paginatedResponse(openapi.schemaRef('Resource'))
                 + openapi.badRequestResponse(),
    },
  },
}
