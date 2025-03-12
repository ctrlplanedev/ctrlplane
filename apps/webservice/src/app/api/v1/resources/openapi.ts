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
        summary: "Create or update multiple resources",
        operationId: "upsertResources",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "resources"],
                properties: {
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                  },
                  resources: {
                    type: "array",
                    items: {
                      type: "object",
                      required: [
                        "name",
                        "kind",
                        "identifier",
                        "version",
                        "config",
                      ],
                      properties: {
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
            },
          },
        },
        responses: {
          200: {
            description: "All of the cats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
      get: {
        summary: "List all resources",
        operationId: "listResources",
        responses: {
          "200": {
            description: "All resources",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Resource" },
                    }
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
