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
    },
  },
};
