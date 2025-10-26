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
}
