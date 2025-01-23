import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/environments/{environmentId}": {
      get: {
        summary: "Get an environment",
        operationId: "getEnvironment",
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
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Environment",
                },
              },
            },
          },
          "404": {
            description: "Environment not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string", example: "Environment not found" },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },

      delete: {
        summary: "Delete an environment",
        operationId: "deleteEnvironment",
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
          "200": {
            description: "Environment deleted successfully",
          },
        },
      },
    },
  },
};
