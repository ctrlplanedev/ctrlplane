local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/relationships': {
    get: {
      tags: ['Relationships'],
      summary: 'Get all relationships',
      operationId: 'getAllRelationships',
      description: 'Returns a paginated list of relationships for workspace {workspaceId}.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('RelationshipRule')),
    },
  },
}