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
  },
}