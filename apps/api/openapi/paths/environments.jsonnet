local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/environments': {
    get: {
      summary: 'List environments',
      operationId: 'listEnvironments',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('EnvironmentAndSystem')),
    },
    put: {
      summary: 'Upsert environment',
      operationId: 'upsertEnvironment',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertEnvironmentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('Environment')),
    },
  },
  '/v1/workspaces/{workspaceId}/environments/{environmentId}': {
    get: {
      summary: 'Get environment',
      operationId: 'getEnvironment',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Environment'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete environment',
      operationId: 'deleteEnvironment',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('Environment')),
    },
    put: {
      summary: 'Upsert environment',
      operationId: 'upsertEnvironmentById',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('Environment'),
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('Environment'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
