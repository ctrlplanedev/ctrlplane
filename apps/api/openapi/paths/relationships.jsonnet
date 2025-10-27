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
  '/v1/workspaces/{workspaceId}/relationships/{relationshipId}': {
    get: {
      summary: 'Get relationship',
      operationId: 'getRelationship',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert relationship',
      operationId: 'upsertRelationshipById',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete relationship',
      operationId: 'deleteRelationship',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('RelationshipRule')) 
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
