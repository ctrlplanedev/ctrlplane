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
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    slug: { type: "string" },
                    description: { type: "string" },
                    workspaceId: { type: "string" },
                    environments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string", nullable: true },
                          createdAt: { type: "string", format: "date-time" },
                          systemId: { type: "string" },
                          policyId: { type: "string", nullable: true },
                          resourceFilter: {
                            type: "object",
                            additionalProperties: true,
                            nullable: true,
                          },
                        },
                      },
                    },
                    deployments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          slug: { type: "string" },
                          description: { type: "string" },
                          systemId: { type: "string" },
                          jobAgentId: { type: "string", nullable: true },
                          jobAgentConfig: {
                            type: "object",
                            additionalProperties: true,
                          },
                        },
                      },
                    },
                  },
                  required: [
                    "id",
                    "name",
                    "slug",
                    "description",
                    "workspaceId",
                    "environments",
                    "deployments",
                  ],
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
