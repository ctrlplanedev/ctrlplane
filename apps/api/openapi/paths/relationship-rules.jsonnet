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
    post: {
      summary: 'Create relationship rule',
      operationId: 'createRelationshipRule',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateRelationshipRuleRequest'),
          },
        },
      },
      responses: openapi.createdResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}': {
    get: {
      summary: 'Get relationship',
      operationId: 'getRelationshipRule',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipRuleIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert relationship',
      operationId: 'requestRelationshipRuleUpsert',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipRuleIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertRelationshipRuleRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete relationship',
      operationId: 'deleteRelationship',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.relationshipRuleIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('RelationshipRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
