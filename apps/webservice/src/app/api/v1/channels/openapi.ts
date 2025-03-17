import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/channels": {
      post: {
        summary: "Create a channel",
        operationId: "createChannel",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["deploymentId", "name", "versionSelector"],
                properties: {
                  deploymentId: { type: "string" },
                  name: { type: "string" },
                  description: { type: "string", nullable: true },
                  versionSelector: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Channel created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    deploymentId: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                    versionSelector: {
                      type: "object",
                      additionalProperties: true,
                    },
                  },
                  required: ["id", "deploymentId", "name", "createdAt"],
                },
              },
            },
          },
          "409": {
            description: "Channel already exists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    id: { type: "string" },
                  },
                  required: ["error", "id"],
                },
              },
            },
          },
          "500": {
            description: "Failed to create channel",
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
          "401": {
            description: "Unauthorized",
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
          "403": {
            description: "Forbidden",
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
        security: [{ bearerAuth: [] }],
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
  },
};
