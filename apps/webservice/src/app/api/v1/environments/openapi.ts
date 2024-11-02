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
                required: ["systemId"],
                properties: {
                  systemId: {
                    type: "string",
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
                        expiresAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
                      required: ["systemId"],
                    },
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
