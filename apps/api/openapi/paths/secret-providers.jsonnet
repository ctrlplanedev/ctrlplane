local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/secret-providers': {
    get: {
      summary: 'List secret providers',
      operationId: 'listSecretProviders',
      description: 'Returns the metadata of every secret provider configured in the workspace. Encrypted configurations are never returned.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('SecretProvider'))
                 + openapi.badRequestResponse(),
    },
  },
  '/v1/workspaces/{workspaceId}/secret-providers/{providerId}': {
    parameters: [
      openapi.workspaceIdParam(),
      openapi.stringParam('providerId', 'ID of the secret provider'),
    ],
    get: {
      summary: 'Get a secret provider',
      operationId: 'getSecretProvider',
      responses: openapi.okResponse(openapi.schemaRef('SecretProvider'))
                 + openapi.notFoundResponse(),
    },
    put: {
      summary: 'Upsert a secret provider',
      operationId: 'requestSecretProviderUpsert',
      description: 'Creates or updates a secret provider. The config is encrypted at rest before persistence.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertSecretProviderRequest'),
          },
        },
      },
      responses: openapi.acceptedResponse(openapi.schemaRef('SecretProviderRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
    delete: {
      summary: 'Delete a secret provider',
      operationId: 'requestSecretProviderDeletion',
      description: 'Variable values that reference this provider will fail to resolve until they are updated or the provider is recreated.',
      responses: openapi.acceptedResponse(openapi.schemaRef('SecretProviderRequestAccepted'), 'Secret provider deleted')
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
