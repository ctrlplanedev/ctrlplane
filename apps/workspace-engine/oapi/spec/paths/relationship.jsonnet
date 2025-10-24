local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/relationship-rules': {
    get: {
      summary: 'Get relationship rules for a given workspace',
      operationId: 'getRelationshipRules',
      description: 'Returns all relationship rules for the specified workspace.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.offsetParam(),
        openapi.limitParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/entities/{relatableEntityType}/{entityId}/relations': {
    get: {
      summary: 'Get related entities for a given entity',
      operationId: 'getRelatedEntities',
      description: 'Returns all entities related to the specified entity (deployment, environment, or resource) based on relationship rules. Relationships are grouped by relationship reference.',
      parameters: [
        openapi.workspaceIdParam(),
        { '$ref': '#/components/parameters/relatableEntityType' },
        openapi.entityIdParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            relations: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: openapi.schemaRef('EntityRelation'),
              },
            },
          },
        },
        'Related entities grouped by relationship reference',
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}
