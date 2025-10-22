local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/release-targets/evaluate': {
    post: {
      summary: 'Evaluate policies for a release target',
      operationId: 'evaluateReleaseTarget',
      description: 'Evaluates all policies and rules that apply to a given release target and returns the evaluation results.',
      parameters: [
        openapi.workspaceIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('EvaluateReleaseTargetRequest'),
          },
        },
      },
      responses: openapi.okResponse(
        {
          properties: {
            workspaceDecision: openapi.schemaRef('DeployDecision'),
            versionDecision: openapi.schemaRef('DeployDecision'),
          },
        },
        'Policy evaluation results for the release target',
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetId}/policies': {
    get: {
      summary: 'Get policies for a release target',
      operationId: 'getPoliciesForReleaseTarget',
      description: 'Returns a list of policies for a release target {releaseTargetId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetIdParam(),
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
        'A list of policies',
      ) + openapi.notFoundResponse(),
    },
  },
}
