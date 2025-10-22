local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/entities/{relatableEntityType}/{entityId}/relationships': {
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
            relationships: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: openapi.schemaRef('RelatedEntityGroup'),
              },
            },
          },
        },
        'Related entities grouped by relationship reference',
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}
