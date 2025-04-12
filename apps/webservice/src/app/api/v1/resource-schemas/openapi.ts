import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/resource-schemas": {
      post: {
        summary: "Create a resource schema",
        operationId: "createResourceSchema",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "version", "kind", "jsonSchema"],
                properties: {
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                    description: "The ID of the workspace",
                  },
                  version: {
                    type: "string",
                    description: "Version of the schema",
                  },
                  kind: {
                    type: "string",
                    description: "Kind of resource this schema is for",
                  },
                  jsonSchema: {
                    type: "object",
                    description: "The JSON schema definition",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Resource schema created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      format: "uuid",
                    },
                    workspaceId: {
                      type: "string",
                      format: "uuid",
                    },
                    version: {
                      type: "string",
                    },
                    kind: {
                      type: "string",
                    },
                    jsonSchema: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
          409: {
            description: "Schema already exists for this version and kind",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                    },
                    id: {
                      type: "string",
                      format: "uuid",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/resource-schemas/{schemaId}": {
      delete: {
        summary: "Delete a resource schema",
        operationId: "deleteResourceSchema",
        parameters: [
          {
            name: "schemaId",
            in: "path",
            required: true,
            description: "UUID of the schema to delete",
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        responses: {
          200: {
            description: "Schema deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      format: "uuid",
                    },
                  },
                },
              },
            },
          },
          404: {
            description: "Schema not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Schema not found",
                    },
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
