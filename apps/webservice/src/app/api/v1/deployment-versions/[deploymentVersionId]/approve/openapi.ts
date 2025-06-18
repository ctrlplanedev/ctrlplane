import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  components: {
    schemas: {
      ApprovalRecord: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          deploymentVersionId: { type: "string", format: "uuid" },
          environmentId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["approved", "rejected"] },
          approvedAt: { type: "string", format: "date-time", nullable: true },
          reason: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "deploymentVersionId",
          "environmentId",
          "userId",
          "status",
          "approvedAt",
          "createdAt",
          "updatedAt",
        ],
      },
    },
  },
  paths: {
    "/v1/deployment-versions/{deploymentVersionId}/approve": {
      post: {
        summary: "Approve a deployment version",
        operationId: "approveDeploymentVersion",
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
                  approvedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Deployment version approved",
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
