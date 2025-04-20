import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/environments/{environmentId}/resources": {
      get: {
        summary: "Get resources for an environment",
        operationId: "getResourcesForEnvironment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the environment",
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    resources: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          identifier: { type: "string" },
                          kind: { type: "string" },
                          version: { type: "string" },
                        },
                      },
                    },
                    count: { type: "number" },
                  },
                },
              },
            },
          },
          500: {
            description: "Internal Server Error",
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
