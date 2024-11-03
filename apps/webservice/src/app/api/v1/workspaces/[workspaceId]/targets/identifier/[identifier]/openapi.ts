import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/workspaces/{workspaceId}/targets/identifier/{identifier}": {
      get: {
        summary: "Get a target by identifier",
        operationId: "getTargetByIdentifier",
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
            description: "Identifier of the target",
          },
        ],
        responses: {
          "200": {
            description: "Successfully retrieved the target",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                    },
                    identifier: {
                      type: "string",
                    },
                    workspaceId: {
                      type: "string",
                    },
                    providerId: {
                      type: "string",
                    },
                    provider: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        workspaceId: { type: "string" },
                      },
                    },
                    variables: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          key: { type: "string" },
                          value: { type: "string" },
                        },
                      },
                    },
                    metadata: {
                      type: "object",
                      additionalProperties: {
                        type: "string",
                      },
                    },
                  },
                  required: ["id", "identifier", "workspaceId", "providerId"],
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
            description: "Target not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Target not found",
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
        summary: "Delete a target by identifier",
        operationId: "deleteTargetByIdentifier",
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
            description: "Identifier of the target",
          },
        ],
        responses: {
          "200": {
            description: "Successfully deleted the target",
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
            description: "Target not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Target not found",
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