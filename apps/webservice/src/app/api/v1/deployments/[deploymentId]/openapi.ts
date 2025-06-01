import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployments/{deploymentId}": {
      get: {
        summary: "Get a deployment",
        operationId: "getDeployment",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Deployment found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Deployment" },
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
        },
      },
      delete: {
        summary: "Delete a deployment",
        operationId: "deleteDeployment",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Deployment deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Deployment" },
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
            description: "Failed to delete deployment",
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
      patch: {
        summary: "Update a deployment",
        operationId: "updateDeployment",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  slug: { type: "string" },
                  description: { type: "string" },
                  systemId: { type: "string", format: "uuid" },
                  jobAgentId: {
                    type: "string",
                    format: "uuid",
                    nullable: true,
                  },
                  jobAgentConfig: {
                    type: "object",
                    additionalProperties: true,
                  },
                  retryCount: { type: "integer" },
                  timeout: { type: "integer", nullable: true },
                  resourceSelector: {
                    type: "object",
                    additionalProperties: true,
                    nullable: true,
                  },
                  exitHooks: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ExitHook" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Deployment updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Deployment" },
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
            description: "Failed to update deployment",
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
