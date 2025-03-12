import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/environments": {
      post: {
        summary: "Create an environment",
        operationId: "createEnvironment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["systemId", "name"],
                properties: {
                  directory: {
                    type: "string",
                    description: "The directory path of the environment",
                    example: "my/env/path",
                    default: "",
                  },
                  systemId: {
                    type: "string",
                  },
                  name: {
                    type: "string",
                  },
                  description: {
                    type: "string",
                  },
                  resourceFilter: {
                    type: "object",
                    additionalProperties: true,
                  },
                  policyId: {
                    type: "string",
                  },
                  releaseChannels: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  metadata: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Environment created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Environment" },
              },
            },
          },
          "409": {
            description: "Environment already exists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    id: { type: "string" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Failed to create environment",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                    },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
      get: {
        summary: "List all environments",
        operationId: "listEnvironments",
        responses: {
          "200": {
            description: "All environments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {$ref: "#/components/schemas/Environment"},
                    }
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
