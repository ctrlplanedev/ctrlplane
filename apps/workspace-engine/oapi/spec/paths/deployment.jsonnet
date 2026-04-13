local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployments': {
    get: {
      summary: 'List deployments',
      operationId: 'listDeployments',
      description: 'Returns a paginated list of deployments for a workspace. Optionally filter with a CEL expression using the "deployment" variable.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
        openapi.celParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentAndSystems'))
                 + openapi.badRequestResponse(),
    },
  },
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
                 + openapi.badRequestResponse()
                 + openapi.notFoundResponse(),
    },
  },
}
