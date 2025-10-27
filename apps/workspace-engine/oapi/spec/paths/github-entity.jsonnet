local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/github-entities/{installationId}': {
    get: {
      summary: 'Get GitHub entity by installation ID',
      operationId: 'getGitHubEntityByInstallationId',
      description: 'Returns a GitHub entity by installation ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.integerParam('installationId', 'Installation ID of the GitHub entity'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('GithubEntity'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
