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
                  targetFilter: {
                    type: "object",
                    additionalProperties: true,
                  },
                  policyId: {
                    type: "string",
                  },
                  releaseChannels: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["channelId", "deploymentId"],
                      properties: {
                        channelId: { type: "string" },
                        deploymentId: { type: "string" },
                      },
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
                        systemId: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        description: {
                          type: "string",
                        },
                        expiresAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        targetFilter: {
                          type: "object",
                          additionalProperties: true,
                        },
                      },
                      required: ["systemId"],
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
