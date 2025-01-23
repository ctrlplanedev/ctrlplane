import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/systems": {
      post: {
        summary: "Create a system",
        operationId: "createSystem",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                    description: "The workspace ID of the system",
                  },
                  name: {
                    type: "string",
                    description: "The name of the system",
                  },
                  slug: {
                    type: "string",
                    description: "The slug of the system",
                  },
                  description: {
                    type: "string",
                    description: "The description of the system",
                  },
                },
                required: ["workspaceId", "name", "slug"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "System created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/System" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          code: {
                            type: "string",
                            enum: ["invalid_type", "invalid_literal", "custom"],
                          },
                          message: { type: "string" },
                          path: {
                            type: "array",
                            items: {
                              oneOf: [{ type: "string" }, { type: "number" }],
                            },
                          },
                        },
                        required: ["code", "message", "path"],
                      },
                    },
                  },
                },
                examples: {
                  "validation-error": {
                    value: {
                      error: [
                        {
                          code: "invalid_type",
                          message: "Invalid input",
                          path: ["name"],
                        },
                      ],
                    },
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
                    error: { type: "string", example: "Internal Server Error" },
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
