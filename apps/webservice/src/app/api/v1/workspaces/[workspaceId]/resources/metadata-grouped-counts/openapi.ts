import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/workspaces/{workspaceId}/resources/metadata-grouped-counts": {
      post: {
        summary: "Get grouped counts of resources",
        operationId: "getGroupedCounts",
        parameters: [
          {
            name: "workspaceId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID of the workspace",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["metadataKeys", "allowNullCombinations"],
                properties: {
                  metadataKeys: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  allowNullCombinations: {
                    type: "boolean",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["keys", "combinations"],
                  properties: {
                    keys: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },
                    combinations: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["metadata", "resources"],
                        properties: {
                          metadata: {
                            type: "object",
                            additionalProperties: {
                              type: "string",
                            },
                          },
                          resources: {
                            type: "number",
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
      },
    },
  },
};
