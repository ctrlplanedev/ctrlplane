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
    post: {
      summary: "Create deployment",
      operationId: "createDeployment",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: openapi.schemaRef('CreateDeploymentRequest'),
          },
        },
      },
      responses: openapi.createdResponse(openapi.schemaRef('Deployment')),
    },
  },
}