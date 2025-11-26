local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/jobs': {
    get: {
      summary: 'Get jobs for a release target',
      operationId: 'getJobsForReleaseTarget',
      description: 'Returns a list of jobs for a release target {releaseTargetKey}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
        openapi.celParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Job'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/desired-release': {
    get: {
      summary: 'Get the desired release for a release target',
      operationId: 'getReleaseTargetDesiredRelease',
      description: 'Returns the desired release for a release target {releaseTargetKey}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
      ],
      responses: openapi.okResponse(
        {
          properties: {
            desiredRelease: openapi.schemaRef('Release'),
          },
        },
        'The desired release for the release target',
      ) + openapi.notFoundResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state': {
    get: {
      summary: 'Get the state for a release target',
      operationId: 'getReleaseTargetState',
      description: 'Returns the state for a release target {releaseTargetKey}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
        {
          name: 'bypassCache',
          'in': 'query',
          description: 'Whether to bypass the cache',
          schema: { type: 'boolean' },
          required: false,
        },
      ],
      responses: openapi.okResponse(
        openapi.schemaRef('ReleaseTargetState'),
        'The state for the release target',
      ) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}