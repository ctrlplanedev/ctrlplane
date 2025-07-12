import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      BaseDeploymentVariableValue: {
        type: "object",
        properties: {
          resourceSelector: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
          isDefault: { type: "boolean" },
          priority: { type: "number" },
        },
      },
      DirectDeploymentVariableValue: {
        allOf: [
          { $ref: "#/components/schemas/BaseDeploymentVariableValue" },
          {
            type: "object",
            properties: {
              value: {
                oneOf: [
                  { type: "string" },
                  { type: "number" },
                  { type: "boolean" },
                  { type: "object" },
                  { type: "array" },
                ],
                nullable: true,
              },
              sensitive: { type: "boolean" },
            },
            required: ["value"],
          },
        ],
      },
      DirectDeploymentVariableValueWithId: {
        allOf: [
          { $ref: "#/components/schemas/DirectDeploymentVariableValue" },
          {
            type: "object",
            properties: { id: { type: "string", format: "uuid" } },
            required: ["id"],
          },
        ],
      },
      ReferenceDeploymentVariableValue: {
        allOf: [
          { $ref: "#/components/schemas/BaseDeploymentVariableValue" },
          {
            type: "object",
            properties: {
              path: {
                type: "array",
                items: { type: "string" },
              },
              reference: { type: "string" },
              defaultValue: {
                oneOf: [
                  { type: "string" },
                  { type: "number" },
                  { type: "boolean" },
                  { type: "object" },
                  { type: "array" },
                ],
                nullable: true,
              },
            },
            required: ["path", "reference"],
          },
        ],
      },
      ReferenceDeploymentVariableValueWithId: {
        allOf: [
          { $ref: "#/components/schemas/ReferenceDeploymentVariableValue" },
          {
            type: "object",
            properties: { id: { type: "string", format: "uuid" } },
            required: ["id"],
          },
        ],
      },
      DeploymentVariable: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          key: { type: "string" },
          description: { type: "string" },
          directValues: {
            type: "array",
            items: {
              $ref: "#/components/schemas/DirectDeploymentVariableValueWithId",
            },
          },
          referenceValues: {
            type: "array",
            items: {
              $ref: "#/components/schemas/ReferenceDeploymentVariableValueWithId",
            },
          },
          defaultValue: {
            oneOf: [
              {
                $ref: "#/components/schemas/DirectDeploymentVariableValueWithId",
              },
              {
                $ref: "#/components/schemas/ReferenceDeploymentVariableValueWithId",
              },
            ],
          },
          config: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: [
          "id",
          "key",
          "description",
          "directValues",
          "referenceValues",
          "config",
        ],
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
                  directValues: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/DirectDeploymentVariableValue",
                    },
                  },
                  referenceValues: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/ReferenceDeploymentVariableValue",
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
