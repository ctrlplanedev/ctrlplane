local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/resources': {
    get: {
      tags: ['Resources'],
      summary: 'Get all resources',
      operationId: 'getAllResources',
      description: 'Returns a paginated list of resources for workspace {workspaceId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
        openapi.celParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Resource')),
    },
  },

  '/v1/workspaces/{workspaceId}/resources/identifier/{identifier}': {
    get: {
      tags: ['Resources'],
      summary: 'Get resource by identifier',
      operationId: 'getResourceByIdentifier',
      description: 'Returns a resource by its identifier.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.identifierParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Resource')),
    },
    delete: {
      tags: ['Resources'],
      summary: 'Delete resource by identifier',
      operationId: 'deleteResourceByIdentifier',
      description: 'Deletes a resource by its identifier.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.identifierParam(),
      ],
      responses: openapi.noContent() + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables': {
    get: {
      tags: ['Resources'],
      summary: 'Get variables for a resource',
      operationId: 'getVariablesForResource',
      description: 'Returns a list of variables for a resource',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.identifierParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('ResourceVariable'), 'The requested variables') +
                 openapi.notFoundResponse() +
                 openapi.badRequestResponse(),
    },
    patch: {
      tags: ['Resources'],
      summary: 'Update variables for a resource',
      operationId: 'updateVariablesForResource',
      description: 'Updates the variables for a resource',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.identifierParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
      responses: openapi.acceptedResponse(
        {
          type: 'object',
          additionalProperties: true,
        },
        'The updated variables'
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets/deployment/{deploymentId}': {
    get: {
      tags: ['Resources'],
      summary: 'Get release target for a resource in a deployment',
      operationId: 'getReleaseTargetForResourceInDeployment',
      description: 'Returns a release target for a resource in a deployment.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.resourceIdentifierParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('ReleaseTarget'), 'The requested release target') +
                 openapi.notFoundResponse() +
                 openapi.badRequestResponse(),
    },
  },
}
