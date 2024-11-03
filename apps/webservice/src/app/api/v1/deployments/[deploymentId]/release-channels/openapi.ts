import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployments/{deploymentId}/release-channels": {
      post: {
        summary: "Create a release channel",
        operationId: "createReleaseChannel",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: {
                    type: "string",
                  },
                  description: {
                    type: "string",
                  },
                  releaseFilter: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Release channel created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                    },
                    name: {
                      type: "string",
                    },
                    description: {
                      type: "string",
                      nullable: true,
                    },
                    deploymentId: {
                      type: "string",
                    },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                  required: [
                    "id",
                    "name",
                    "deploymentId",
                    "createdAt",
                    "updatedAt",
                  ],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                    },
                  },
                  required: ["error"],
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                    },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
    },
  },
};
