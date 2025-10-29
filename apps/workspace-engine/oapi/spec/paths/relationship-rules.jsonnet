local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}': {
    get: {
      summary: 'Get relationship rule',
      operationId: 'getRelationshipRule',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipRuleIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
