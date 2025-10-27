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
      responses: openapi.createdResponse(openapi.schemaRef('System'))
                 + openapi.badRequestResponse(),
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
    patch: {
      summary: 'Update system',
      operationId: 'updateSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpdateSystemRequest'),
          },
        },
      },
      responses: openapi.okResponse(openapi.schemaRef('System'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete system',
      operationId: 'deleteSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      responses: {
        '204': {
          description: 'System deleted successfully',
        },
      } + openapi.notFoundResponse()
        + openapi.badRequestResponse(),
    },
  },
}

