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
      responses: openapi.paginatedResponse(openapi.schemaRef('Environment')),
    },
    post: {
      summary: 'Create environment',
      operationId: 'requestEnvironmentCreation',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateEnvironmentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('EnvironmentRequestAccepted')),
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
      responses: openapi.okResponse(openapi.schemaRef('EnvironmentWithSystems'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete environment',
      operationId: 'requestEnvironmentDeletion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('EnvironmentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert environment',
      operationId: 'requestEnvironmentUpsert',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.environmentIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertEnvironmentRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('EnvironmentRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
