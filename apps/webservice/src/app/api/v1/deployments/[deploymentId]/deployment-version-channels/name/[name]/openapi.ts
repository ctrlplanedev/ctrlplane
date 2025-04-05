import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployments/{deploymentId}/deployment-version-channels/name/{name}": {
      delete: {
        summary: "Delete a deployment version channel",
        operationId: "deleteDeploymentVersionChannel",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "name",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deployment version channel deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                  required: ["message"],
                },
              },
            },
          },
          "403": {
            description: "Permission denied",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                  required: ["error"],
                },
              },
            },
          },
          "404": {
            description: "Deployment version channel not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                  required: ["error"],
                },
              },
            },
          },
          "500": {
            description: "Failed to delete deployment version channel",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
    },
  },
};
