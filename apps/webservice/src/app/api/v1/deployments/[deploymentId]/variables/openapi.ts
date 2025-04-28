import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      DeploymentVariableValue: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          value: {},
          sensitive: { type: "boolean" },
          resourceSelector: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
        },
        required: ["id", "value", "sensitive", "resourceSelector"],
      },
      DeploymentVariable: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          key: { type: "string" },
          description: { type: "string" },
          values: {
            type: "array",
            items: { $ref: "#/components/schemas/DeploymentVariableValue" },
          },
          defaultValue: {
            $ref: "#/components/schemas/DeploymentVariableValue",
          },
          config: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["id", "key", "description", "values", "config"],
      },
    },
  },
  paths: {
    "/v1/deployments/{deploymentId}/variables": {
      get: {
        summary: "Get all variables for a deployment",
        operationId: "getDeploymentVariables",
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
            description: "Variables fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/DeploymentVariable" },
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
            description: "Failed to fetch variables",
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
      post: {
        summary: "Create a new variable for a deployment",
        operationId: "createDeploymentVariable",
        parameters: [
          {
            name: "deploymentId",
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
                  key: { type: "string" },
                  description: { type: "string" },
                  config: {
                    type: "object",
                    additionalProperties: true,
                  },
                  values: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        value: {},
                        sensitive: { type: "boolean" },
                        resourceSelector: {
                          type: "object",
                          additionalProperties: true,
                          nullable: true,
                        },
                        default: { type: "boolean" },
                      },
                      required: ["value"],
                    },
                  },
                },
                required: ["key", "config"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Variable created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeploymentVariable" },
              },
            },
          },
          "400": {
            description: "Invalid request body",
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
            description: "Failed to create variable",
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
