local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/policy-skips': {
    get: {
      summary: 'List policy skips for a workspace',
      operationId: 'listPolicySkips',
      description: 'Returns a list of policy skips for workspace {workspaceId}.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            skips: {
              type: 'array',
              items: openapi.schemaRef('PolicySkip'),
            },
          },
        },
        'A list of policy skips'
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/policy-skips/{policySkipId}': {
    get: {
      summary: 'Get policy skip by ID',
      operationId: 'getPolicySkip',
      description: 'Returns a specific policy skip by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        {
          name: 'policySkipId',
          'in': 'path',
          description: 'Policy skip ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: openapi.okResponse(
        openapi.schemaRef('PolicySkip'),
        'The requested policy skip'
      ) + openapi.notFoundResponse(),
    },
  },
}
