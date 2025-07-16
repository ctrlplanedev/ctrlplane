import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}": {
      get: {
        summary: "Get a resource by identifier",
        operationId: "getResourceByIdentifier",
        parameters: [
          {
            name: "workspaceId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "ID of the workspace",
          },
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifier of the resource",
          },
        ],
        responses: {
          "200": {
            description: "Successfully retrieved the resource",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    {
                      $ref: "#/components/schemas/ResourceWithVariablesAndMetadata",
                    },
                    {
                      type: "object",
                      properties: {
                        relationships: {
                          type: "object",
                          additionalProperties: {
                            type: "object",
                            properties: {
                              ruleId: { type: "string" },
                              type: { type: "string" },
                              reference: { type: "string" },
                              source: { $ref: "#/components/schemas/Resource" },
                            },
                            required: ["ruleId", "type", "reference", "source"],
                          },
                        },
                      },
                    },
                  ],
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
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
      delete: {
        summary: "Delete a resource by identifier",
        operationId: "deleteResourceByIdentifier",
        parameters: [
          {
            name: "workspaceId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "ID of the workspace",
          },
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "Identifier of the resource",
          },
        ],
        responses: {
          "200": {
            description: "Successfully deleted the resource",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
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
                      example: "Resource not found",
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
  },
};
