local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces': {
    get: {
      summary: 'List workspace IDs',
      operationId: 'listWorkspaceIds',
      description: 'Returns a list of workspace that are in memory. These could be inactive.',
      responses: openapi.okResponse(
        'A list of workspace IDs',
        {
          type: 'object',
          properties: {
            workspaceIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        }
      ),
    },
  },
}
