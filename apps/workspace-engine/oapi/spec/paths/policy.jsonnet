local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/policies': {
    get: {
      summary: 'List policies',
      operationId: 'listPolicies',
      description: 'Returns a list of policies for workspace {workspaceId}.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            policies: {
              type: 'array',
              items: openapi.schemaRef('Policy'),
            },
          },
        },
        'A list of policies'
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/policies/{policyId}': {
    get: {
      summary: 'Get policy',
      operationId: 'getPolicy',
      description: 'Returns a specific policy by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
      ],
      responses: openapi.okResponse(
                   openapi.schemaRef('Policy'),
                   'The requested policy'
                 )
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/policies/{policyId}/release-targets': {
    get: {
      summary: 'Get release targets for a policy',
      operationId: 'getReleaseTargetsForPolicy',
      description: 'Returns a list of release targets for a policy {policyId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
      ],
      responses: openapi.okResponse(
        {
          type: 'object',
          properties: {
            releaseTargets: {
              type: 'array',
              items: openapi.schemaRef('ReleaseTarget'),
            },
          },
        },
        'A list of release targets'
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/policies/{policyId}/rules/{ruleId}': {
    get: {
      summary: 'Get rule',
      operationId: 'getRule',
      description: 'Returns a specific rule by ID.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.policyIdParam(),
        openapi.ruleIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('PolicyRule'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
