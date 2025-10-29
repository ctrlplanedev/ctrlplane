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
    post: {
      summary: 'Create a policy',
      operationId: 'createPolicy',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: openapi.schemaRef('CreatePolicyRequest') },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Policy')) + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/policies/{policyId}': {
    get: {
      summary: 'Get a policy by ID',
      operationId: 'getPolicy',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Policy')) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete a policy by ID',
      operationId: 'deletePolicy',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('Policy'), 'Policy updated')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert a policy by ID',
      operationId: 'updatePolicy',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: openapi.schemaRef('UpsertPolicyRequest') },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Policy')) +
                 openapi.badRequestResponse() +
                 openapi.notFoundResponse(),
    },
  },
}
