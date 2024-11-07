import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/targets": {
      post: {
        summary: "Create or update multiple targets",
        operationId: "upsertTargets",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "targets"],
                properties: {
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                  },
                  targets: {
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
                        name: {
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
                            type: "object",
                            required: ["key", "value"],
                            properties: {
                              key: {
                                type: "string",
                              },
                              value: {
                                oneOf: [
                                  { type: "string" },
                                  { type: "number" },
                                  { type: "boolean" },
                                ],
                              },
                              sensitive: {
                                type: "boolean",
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
        responses: {
          200: {
            description: "All of the cats",
          },
        },
      },
    },
  },
};
