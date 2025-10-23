local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/validate/resource-selector': {
    post: {
      summary: 'Validate a resource selector',
      operationId: 'validateResourceSelector',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                resourceSelector: openapi.schemaRef('Selector'),
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The validated resource selector',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['valid', 'errors'],
                properties: {
                  valid: { type: 'boolean' },
                  errors: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
}
