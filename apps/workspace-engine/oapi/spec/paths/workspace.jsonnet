local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces': {
    get: {
      summary: 'List workspace IDs',
      operationId: 'listWorkspaceIds',
      description: 'Returns a list of workspace that are in memory. These could be inactive.',
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            workspaceIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        'A list of workspace IDs'
      ),
    },
  },

  '/v1/workspaces/{workspaceId}/status': {
    get: {
      summary: 'Get engine status',
      operationId: 'getEngineStatus',
      description: 'Returns the status of the engine.',
      parameters: [openapi.workspaceIdParam()],
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            healthy: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        'The status of the engine'
      ),
    },
  },
}
