local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/systems': {
    get: {
      summary: 'List systems',
      operationId: 'listSystems',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('System')),
    },
    post: {
      summary: 'Create system',
      operationId: 'createSystem',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateSystemRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('System')),
    },
    put: {
      summary: 'Upsert system',
      operationId: 'upsertSystem',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('System'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('System')),
    },
  },
  '/v1/workspaces/{workspaceId}/systems/{systemId}': {
    get: {
      summary: 'Get system',
      operationId: 'getSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('System'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      summary: 'Upsert system',
      operationId: 'upsertSystemById',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('System'),
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('System'))
    },
    delete: {
      summary: 'Delete system',
      operationId: 'deleteSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('System'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
