local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/policies': {
    get: {
      summary: 'List policies',
      operationId: 'listPolicies',
      parameters: [
        openapi.workspaceIdParam(),
      ],
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
      summary: 'Upsert a policy',
      operationId: 'upsertPolicy',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: { required: true, content: { 'application/json': { schema: openapi.schemaRef('UpsertPolicyRequest') } } },
      responses: openapi.acceptedResponse(openapi.schemaRef('Policy')) + openapi.okResponse(openapi.schemaRef('Policy')) + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/policies/{policyId}': {
    delete: {
      summary: 'Delete a policy by ID',
      operationId: 'deletePolicy',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Policy'))
        + openapi.notFoundResponse()
        + openapi.badRequestResponse(),
    },
  }
}
