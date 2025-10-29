local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/user-approval-records': {
    post: {
      summary: 'Create user approval record',
      operationId: 'createUserApprovalRecord',
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentVersionIdParam(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: openapi.schemaRef('UpsertUserApprovalRecordRequest'),
          },
        },
      },
      responses: openapi.okResponse({
        type: 'object',
        properties: {
          success: { type: 'boolean' },
        },
      }) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}
