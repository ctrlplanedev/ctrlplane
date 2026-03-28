local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/deployments/{deploymentId}/release-targets': {
    get: {
      summary: 'List release targets for a deployment',
      operationId: 'listReleaseTargets',
      parameters: [
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse({
                   type: 'object',
                   properties: {
                     items: {
                       type: 'array',
                       items: openapi.schemaRef('ReleaseTargetItem'),
                     },
                   },
                   required: ['items'],
                 }, 'List of release targets for the deployment')
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state': {
    get: {
      summary: 'Get the state of a release target',
      operationId: 'getReleaseTargetState',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
      ],
      responses: openapi.okResponse(
                   openapi.schemaRef('ReleaseTargetStateResponse'),
                   'Release target state',
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
