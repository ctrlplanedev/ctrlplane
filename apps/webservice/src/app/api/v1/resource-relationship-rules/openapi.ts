import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/resource-relationship-rules": {
      post: {
        summary: "Create a resource relationship rule",
        operationId: "createResourceRelationshipRule",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "workspaceId",
                  "name",
                  "reference",
                  "relationshipType",
                  "sourceKind",
                  "sourceVersion",
                  "targetKind",
                  "targetVersion",
                ],
                properties: {
                  workspaceId: {
                    type: "string",
                  },
                  name: {
                    type: "string",
                  },
                  reference: {
                    type: "string",
                  },
                  relationshipType: {
                    type: "string",
                  },
                  description: {
                    type: "string",
                  },
                  sourceKind: {
                    type: "string",
                  },
                  sourceVersion: {
                    type: "string",
                  },
                  targetKind: {
                    type: "string",
                  },
                  targetVersion: {
                    type: "string",
                  },
                  metadataKeysMatch: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resource relationship rule created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    workspaceId: { type: "string" },
                    name: { type: "string" },
                    reference: { type: "string" },
                    relationshipType: { type: "string" },
                    description: { type: "string" },
                    sourceKind: { type: "string" },
                    sourceVersion: { type: "string" },
                    targetKind: { type: "string" },
                    targetVersion: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Failed to create resource relationship rule",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
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
