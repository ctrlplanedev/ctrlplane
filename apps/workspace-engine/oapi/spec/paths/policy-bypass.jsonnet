local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/bypasses': {
    get: {
      summary: 'List policy bypasses',
      operationId: 'listBypasses',
      description: 'Returns a list of policy bypasses for workspace {workspaceId}.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            bypasses: {
              type: 'array',
              items: openapi.schemaRef('PolicyBypass'),
            },
          },
        },
        'A list of policy bypasses'
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/bypasses/{bypassId}': {
    get: {
      summary: 'Get policy bypass',
      operationId: 'getBypass',
      description: 'Returns a specific policy bypass by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        {
          name: 'bypassId',
          'in': 'path',
          description: 'Policy bypass ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: openapi.okResponse(
        openapi.schemaRef('PolicyBypass'),
        'The requested policy bypass'
      ) + openapi.notFoundResponse(),
    },
  },
}
