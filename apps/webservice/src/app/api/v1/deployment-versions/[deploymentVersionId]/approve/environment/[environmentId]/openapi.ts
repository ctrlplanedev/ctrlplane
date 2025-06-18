import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/deployment-versions/{deploymentVersionId}/approve/environment/{environmentId}":
      {
        post: {
          summary: "Approve a deployment version for an environment",
          operationId: "approveDeploymentVersionForEnvironment",
          parameters: [
            {
              name: "deploymentVersionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "environmentId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reason: { type: "string" },
                    approvedAt: { type: "string", format: "date-time" },
                  },
                  required: ["reason"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Approval record created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApprovalRecord" },
                },
              },
            },
            404: {
              description: "Deployment version or environment not found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { error: { type: "string" } },
                  },
                },
              },
            },
            403: {
              description: "Forbidden",
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
