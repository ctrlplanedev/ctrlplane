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
                  expiresAt: {
                    type: "string",
                    format: "date-time",
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
                schema: {
                  type: "object",
                  properties: {
                    environment: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                        },
                        systemId: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        description: {
                          type: "string",
                          nullable: true,
                        },
                        expiresAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        resourceFilter: {
                          type: "object",
                          additionalProperties: true,
                        },
                      },
                      required: ["id", "name", "systemId"],
                    },
                  },
                },
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
    },
  },
};
