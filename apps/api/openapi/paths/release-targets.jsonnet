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

  '/v1/workspaces/{workspaceId}/release-targets/state': {
    post: {
      summary: 'Get release target states by deployment and environment',
      operationId: 'getReleaseTargetStates',
      description: 'Returns paginated release target states for a given deployment and environment.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['deploymentId', 'environmentId'],
              properties: {
                deploymentId: { type: 'string' },
                environmentId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: openapi.paginatedResponse(openapi.schemaRef('ReleaseTargetWithState'))
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/release-targets/resource-preview': {
    post: {
      summary: 'Preview release targets for a resource',
      operationId: 'previewReleaseTargetsForResource',
      description: 'Simulates which release targets would be created if the given resource were added to the workspace. This is a dry-run endpoint — no resources or release targets are actually created.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('ResourcePreviewRequest'),
          },
        },
      },
      responses: openapi.paginatedResponse(openapi.schemaRef('ReleaseTargetPreview'))
                 + openapi.badRequestResponse(),
    },
  },
}