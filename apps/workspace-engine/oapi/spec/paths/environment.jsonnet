local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/environments': {
    get: {
      summary: 'List environments',
      operationId: 'listEnvironments',
      description: 'Returns a list of environments for a workspace.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.offsetParam(),
        openapi.limitParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Environment'), 'A list of environments')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/environments/{environmentId}': {
    get: {
      summary: 'Get environment',
      operationId: 'getEnvironment',
      description: 'Returns a specific environment by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.okResponse(
                   openapi.schemaRef('EnvironmentWithSystems'),
                   'The requested environment'
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/environments/{environmentId}/release-targets': {
    get: {
      summary: 'Get release targets for an environment',
      operationId: 'getReleaseTargetsForEnvironment',
      description: 'Returns a list of release targets for an environment.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('ReleaseTargetWithState'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
