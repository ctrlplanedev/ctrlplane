import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/deployment-versions/{deploymentVersionId}/reject": {
      post: {
        summary: "Reject a deployment version",
        operationId: "rejectDeploymentVersion",
        parameters: [
          {
            name: "deploymentVersionId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "The deployment version ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Deployment version rejected",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalRecord" },
              },
            },
          },
          403: {
            description: "Permission denied",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          404: {
            description: "Deployment version not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};
