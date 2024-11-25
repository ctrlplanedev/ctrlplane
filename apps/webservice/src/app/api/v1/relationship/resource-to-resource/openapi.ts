import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/relationship/resource-to-resource": {
      post: {
        summary: "Create a relationship between two resources",
        operationId: "createResourceToResourceRelationship",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  workspaceId: { type: "string", format: "uuid" },
                  fromIdentifier: { type: "string" },
                  toIdentifier: { type: "string" },
                  type: { type: "string" },
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
          "200": { description: "Relationship created" },
          "400": { description: "Invalid request body" },
          "404": { description: "Resource not found" },
          "409": { description: "Relationship already exists" },
          "500": { description: "Internal server error" },
        },
      },
    },
  },
};
