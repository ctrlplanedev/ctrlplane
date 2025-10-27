local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/user-approval-records': {
    put: {
      summary: 'Upsert user approval record',
      operationId: 'upsertUserApprovalRecord',
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
