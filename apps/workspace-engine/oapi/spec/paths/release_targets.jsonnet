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

  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions': {
    post: {
      summary: 'List versions eligible for a release target',
      operationId: 'listEligibleVersionsForReleaseTarget',
      description: 'Returns deployment versions that currently pass every policy rule for this release target. An optional CEL filter narrows the result; pagination is applied to the filtered set. Use the "version" variable in the CEL expression to access version properties.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description: 'CEL expression to filter eligible versions. Defaults to "true" (all eligible versions).',
                },
              },
            },
          },
        },
      },
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentVersion'), 'Eligible versions for the release target')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
