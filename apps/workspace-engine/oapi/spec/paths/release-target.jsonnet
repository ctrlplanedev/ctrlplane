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
            policiesEvaluated: { type: 'number', description: 'The number of policies evaluated' },
            workspaceDecision: openapi.schemaRef('DeployDecision'),
            versionDecision: openapi.schemaRef('DeployDecision'),
            envVersionDecision: openapi.schemaRef('DeployDecision'),
            envTargetVersionDecision: openapi.schemaRef('DeployDecision'),
          },
        },
        'Policy evaluation results for the release target',
      ) + openapi.notFoundResponse(),
    },
  },

  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/policies': {
    get: {
      summary: 'Get policies for a release target',
      operationId: 'getPoliciesForReleaseTarget',
      description: 'Returns a list of policies for a release target {releaseTargetId}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
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
  '/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/jobs': {
    get: {
      summary: 'Get jobs for a release target',
      operationId: 'getJobsForReleaseTarget',
      description: 'Returns a list of jobs for a release target {releaseTargetKey}.',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.releaseTargetKeyParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
        openapi.celParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('Job'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
