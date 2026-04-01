local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/variable-sets': {
    get: {
      tags: ['Variable Sets'],
      summary: 'List variable sets',
      operationId: 'listVariableSets',
      description: 'Returns a list of variable sets.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('VariableSetWithVariables'))
                 + openapi.badRequestResponse(),
    },
    post: {
      tags: ['Variable Sets'],
      summary: 'Create a variable set',
      operationId: 'createVariableSet',
      description: 'Creates a variable set.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('CreateVariableSet'),
          },
        },
      },
      responses: openapi.createdResponse(openapi.schemaRef('VariableSet'))
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/variable-sets/{variableSetId}': {
    get: {
      tags: ['Variable Sets'],
      summary: 'Get a variable set',
      operationId: 'getVariableSet',
      description: 'Gets a variable set by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.stringParam('variableSetId', 'ID of the variable set'),
      ],
      responses: openapi.okResponse(openapi.schemaRef('VariableSetWithVariables'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    put: {
      tags: ['Variable Sets'],
      summary: 'Update a variable set',
      operationId: 'updateVariableSet',
      description: 'Updates a variable set.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.stringParam('variableSetId', 'ID of the variable set'),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpdateVariableSet'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('VariableSet'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      tags: ['Variable Sets'],
      summary: 'Delete a variable set',
      operationId: 'deleteVariableSet',
      description: 'Deletes a variable set.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.stringParam('variableSetId', 'ID of the variable set'),
      ],
      responses: openapi.acceptedResponse(openapi.schemaRef('VariableSet'), 'Variable set deleted')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
