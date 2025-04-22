import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/resources": {
      post: {
        summary: "Create or update a resource",
        operationId: "upsertResource",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "workspaceId",
                  "name",
                  "kind",
                  "identifier",
                  "version",
                  "config",
                ],
                properties: {
                  workspaceId: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  kind: { type: "string" },
                  identifier: { type: "string" },
                  version: { type: "string" },
                  config: { type: "object" },
                  metadata: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                  variables: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Variable" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "The created or updated resource",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Resource" },
              },
            },
          },
        },
      },
    },
  },
};
