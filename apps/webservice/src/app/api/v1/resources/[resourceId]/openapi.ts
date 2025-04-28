import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/resources/{resourceId}": {
      get: {
        summary: "Get a resource",
        operationId: "getResource",
        parameters: [
          {
            name: "resourceId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "The resource ID",
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResourceWithVariablesAndMetadata",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Permission denied",
          },
          "404": {
            description: "Resource not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Resource not found",
                    },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
      patch: {
        summary: "Update a resource",
        operationId: "updateResource",
        parameters: [
          {
            name: "resourceId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                  },
                  version: {
                    type: "string",
                  },
                  kind: {
                    type: "string",
                  },
                  identifier: {
                    type: "string",
                  },
                  workspaceId: {
                    type: "string",
                  },
                  metadata: { $ref: "#/components/schemas/MetadataMap" },
                  variables: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/DirectVariable",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resource updated successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResourceWithVariablesAndMetadata",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Permission denied",
          },
          "404": {
            description: "Resource not found",
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
      delete: {
        summary: "Delete a resource",
        operationId: "deleteResource",
        parameters: [
          {
            name: "resourceId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "The resource ID",
          },
        ],
        responses: {
          "200": {
            description: "Resource deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success"],
                  properties: {
                    success: {
                      type: "boolean",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Permission denied",
          },
          "404": {
            description: "Resource not found",
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
