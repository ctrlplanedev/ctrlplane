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
      operationId: 'requestSystemCreation',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted')),
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
      operationId: 'requestSystemUpsert',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertSystemRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted')),
    },
    delete: {
      summary: 'Delete system',
      operationId: 'requestSystemDeletion',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}': {
    put: {
      summary: 'Link deployment to system',
      operationId: 'linkDeploymentToSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Unlink deployment from system',
      operationId: 'unlinkDeploymentFromSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}': {
    put: {
      summary: 'Link environment to system',
      operationId: 'linkEnvironmentToSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Unlink environment from system',
      operationId: 'unlinkEnvironmentFromSystem',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.systemIdParam(),
        openapi.environmentIdParam(),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('SystemRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
