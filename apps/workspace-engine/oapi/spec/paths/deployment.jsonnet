local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/deployments/{deploymentId}/job-agents': {
    get: {
      summary: 'Get job agents matching a deployment selector',
      operationId: 'getJobAgentsForDeployment',
      parameters: [
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse({
                   type: 'object',
                   properties: {
                     items: {
                       type: 'array',
                       items: openapi.schemaRef('JobAgent'),
                     },
                   },
                   required: ['items'],
                 }, 'Job agents matching the deployment selector')
                 + openapi.badRequestResponse(),
    },
  },
}
