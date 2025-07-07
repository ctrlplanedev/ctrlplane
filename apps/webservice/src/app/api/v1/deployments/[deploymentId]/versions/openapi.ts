import type { Swagger } from "atlassian-openapi";

import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployments/{deploymentId}/versions": {
      get: {
        summary: "List deployment versions",
        operationId: "listDeploymentVersions",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: Object.values(DeploymentVersionStatus),
            },
          },
        ],
        responses: {
          "200": {
            description: "Deployment versions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/DeploymentVersion",
                  },
                },
              },
            },
          },
          "404": {
            description: "Deployment not found",
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
            description: "Internal server error",
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
