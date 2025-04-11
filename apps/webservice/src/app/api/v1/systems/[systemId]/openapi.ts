import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/systems/{systemId}": {
      get: {
        summary: "Get a system",
        operationId: "getSystem",
        parameters: [
          {
            name: "systemId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "UUID of the system",
          },
        ],
        responses: {
          "200": {
            description: "System retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SystemWithEnvironmentsAndDeployments",
                },
              },
            },
          },
        },
      },
      patch: {
        summary: "Update a system",
        operationId: "updateSystem",
        parameters: [
          {
            name: "systemId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "UUID of the system",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Name of the system" },
                  slug: { type: "string", description: "Slug of the system" },
                  description: {
                    type: "string",
                    description: "Description of the system",
                  },
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                    description: "UUID of the workspace",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "System updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/System" },
              },
            },
          },
          "404": {
            description: "System not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string", example: "System not found" },
                  },
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
                  properties: {
                    error: { type: "string", example: "Internal server error" },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: "Delete a system",
        operationId: "deleteSystem",
        parameters: [
          {
            name: "systemId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "System deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "System deleted" },
                  },
                },
              },
            },
          },
          "404": {
            description: "System not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string", example: "System not found" },
                  },
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
                  properties: {
                    error: { type: "string", example: "Internal server error" },
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
