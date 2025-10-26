local openapi = import '../lib/openapi.libsonnet';

{
  "/v1/workspaces/{workspaceId}/deployments": {
    get: {
      summary: "List deployments",
      operationId: "listDeployments",
      parameters: [
        openapi.workspaceIdParam(),
        openapi.limitParam(),
        openapi.offsetParam(),
      ],
      responses: openapi.paginatedResponse(openapi.schemaRef('DeploymentAndSystem')),
    },
    put: {
      summary: "Upsert deployment",
      operationId: "upsertDeployment",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: openapi.schemaRef('UpsertDeploymentRequest'),
          },
        },
      },
      responses: openapi.createdResponse(openapi.schemaRef('Deployment')),
    },
  },
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}": {
    get: {
      summary: "Get deployment",
      operationId: "getDeployment",
      parameters: [
        openapi.workspaceIdParam(),
        openapi.deploymentIdParam(),
      ],
      responses: openapi.okResponse(openapi.schemaRef('Deployment')) + openapi.notFoundResponse() + openapi.badRequestResponse(),
    },
  },
}