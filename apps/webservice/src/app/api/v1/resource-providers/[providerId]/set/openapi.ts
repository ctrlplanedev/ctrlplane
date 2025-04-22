import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/resource-providers/{providerId}/set": {
      patch: {
        summary: "Sets the resource for a provider.",
        operationId: "setResourceProvidersResources",
        parameters: [
          {
            name: "providerId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the scanner",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["resources"],
                properties: {
                  resources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        identifier: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        version: {
                          type: "string",
                        },
                        kind: {
                          type: "string",
                        },
                        config: {
                          type: "object",
                          additionalProperties: true,
                        },
                        metadata: {
                          type: "object",
                          additionalProperties: {
                            type: "string",
                          },
                        },
                      },
                      required: [
                        "identifier",
                        "name",
                        "version",
                        "kind",
                        "config",
                        "metadata",
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successfully updated the deployment resources",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    resources: {
                      type: "object",
                      properties: {
                        ignored: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              identifier: { type: "string" },
                              name: { type: "string" },
                              version: { type: "string" },
                              kind: { type: "string" },
                              workspaceId: { type: "string" },
                            },
                          },
                        },
                        inserted: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              version: { type: "string" },
                              kind: { type: "string" },
                              config: {
                                type: "object",
                                additionalProperties: true,
                              },
                            },
                          },
                        },
                        updated: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              version: { type: "string" },
                              kind: { type: "string" },
                              config: {
                                type: "object",
                                additionalProperties: true,
                              },
                            },
                          },
                        },
                        deleted: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              version: { type: "string" },
                              kind: { type: "string" },
                              config: {
                                type: "object",
                                additionalProperties: true,
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
          "400": {
            description: "Invalid request",
          },
          "404": {
            description: "Deployment resources not found",
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
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
  },
};
