local openapi = import '../lib/openapi.libsonnet';

{
  "/v1/workspaces/{workspaceId}/policies": {
    get: {
      summary: "List policies",
      operationId: "listPolicies",
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            policies: { type: 'array', items: openapi.schemaRef('Policy') },
          },
        },
        'A list of policies'
      ) + openapi.notFoundResponse(),
    },
    put: {
      summary: "Upsert a policy",
      operationId: "upsertPolicy",
      requestBody: { required: true, content: { "application/json": { schema: openapi.schemaRef('UpsertPolicyRequest') } } },
      responses: openapi.createdResponse(openapi.schemaRef('Policy')) + openapi.okResponse(openapi.schemaRef('Policy'))  + openapi.badRequestResponse(),
    },
  },
}