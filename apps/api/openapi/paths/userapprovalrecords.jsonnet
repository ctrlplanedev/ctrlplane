local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/user-approval-records': {
    put: {
      summary: 'Upsert user approval record',
      operationId: 'requestUserApprovalRecordUpsert',
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
      responses: openapi.acceptedResponse(openapi.schemaRef('UserApprovalRecordRequestAccepted'))
                 + openapi.notFoundResponse()
                 + openapi.badRequestResponse(),
    },
  },
}
