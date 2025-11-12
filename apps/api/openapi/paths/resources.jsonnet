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
  }
}
