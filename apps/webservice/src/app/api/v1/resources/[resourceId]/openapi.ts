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
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                    },
                    name: {
                      type: "string",
                    },
                    workspaceId: {
                      type: "string",
                    },
                    kind: {
                      type: "string",
                    },
                    identifier: {
                      type: "string",
                    },
                    version: {
                      type: "string",
                    },
                    config: {
                      type: "object",
                      additionalProperties: true,
                    },
                    lockedAt: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                    },
                    provider: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                      },
                    },
                    metadata: {
                      type: "object",
                      additionalProperties: {
                        type: "string",
                      },
                    },
                    variables: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Variable",
                      },
                    },
                  },
                  required: [
                    "id",
                    "name",
                    "kind",
                    "identifier",
                    "version",
                    "config",
                    "workspaceId",
                    "updatedAt",
                    "metadata",
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
                  metadata: {
                    type: "object",
                    additionalProperties: {
                      type: "string",
                    },
                  },
                  variables: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Variable",
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
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                    },
                    name: {
                      type: "string",
                    },
                    workspaceId: {
                      type: "string",
                    },
                    kind: {
                      type: "string",
                    },
                    identifier: {
                      type: "string",
                    },
                    version: {
                      type: "string",
                    },
                    config: {
                      type: "object",
                      additionalProperties: true,
                    },
                    metadata: {
                      type: "object",
                      additionalProperties: {
                        type: "string",
                      },
                    },
                  },
                  required: [
                    "id",
                    "name",
                    "kind",
                    "identifier",
                    "version",
                    "config",
                    "workspaceId",
                    "metadata",
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
