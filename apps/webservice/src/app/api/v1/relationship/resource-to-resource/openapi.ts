import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/relationship/resource-to-resource": {
      post: {
        summary: "Create a relationship between two resources",
        operationId: "createResourceToResourceRelationship",
        tags: ["Resource Relationships"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                    description: "The workspace ID",
                    example: "123e4567-e89b-12d3-a456-426614174000",
                  },
                  fromIdentifier: {
                    type: "string",
                    description: "The identifier of the resource to connect",
                    example: "my-resource",
                  },
                  toIdentifier: {
                    type: "string",
                    description: "The identifier of the resource to connect to",
                    example: "my-resource",
                  },
                  type: {
                    type: "string",
                    description: "The type of relationship",
                    example: "depends_on",
                  },
                },
                required: [
                  "workspaceId",
                  "fromIdentifier",
                  "toIdentifier",
                  "type",
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Relationship created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Relationship created successfully",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "404": {
            description: "Resource not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "409": {
            description: "Relationship already exists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
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
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};
