local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployment-versions/{versionId}/jobs-list': {
    get: {
      summary: 'Get deployment version jobs list',
      operationId: 'getDeploymentVersionJobsList',
      description: 'Returns jobs grouped by environment and release target for a deployment version.',
      parameters: [
        openapi.workspaceIdParam(),
        {
          name: 'versionId',
          'in': 'path',
          required: true,
          description: 'ID of the deployment version',
          schema: { type: 'string' },
        },
      ],
      responses: openapi.okResponse(
        {
          type: 'array',
          items: {
            type: 'object',
            required: ['environment', 'releaseTargets'],
            properties: {
              environment: openapi.schemaRef('Environment'),
              releaseTargets: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'resourceId', 'environmentId', 'deploymentId', 'environment', 'deployment', 'resource', 'jobs'],
                  properties: {
                    // ReleaseTarget fields (flattened)
                    id: { type: 'string' },
                    resourceId: { type: 'string' },
                    environmentId: { type: 'string' },
                    deploymentId: { type: 'string' },
                    // Additional related entities
                    environment: openapi.schemaRef('Environment'),
                    deployment: openapi.schemaRef('Deployment'),
                    resource: openapi.schemaRef('Resource'),
                    // Jobs array
                    jobs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['id', 'createdAt', 'status', 'metadata'],
                        properties: {
                          id: { type: 'string' },
                          createdAt: { type: 'string', format: 'date-time' },
                          status: openapi.schemaRef('JobStatus'),
                          externalId: { type: 'string' },
                          metadata: {
                            type: 'object',
                            additionalProperties: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'Jobs list grouped by environment and release target',
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}
