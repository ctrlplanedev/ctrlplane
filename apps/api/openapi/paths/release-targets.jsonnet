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
  }
}