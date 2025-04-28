import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/release-targets/{releaseTargetId}/releases": {
      get: {
        summary: "Get the latest 100 releases for a release target",
        operationId: "getReleaseTargetReleases",
        parameters: [
          {
            name: "releaseTargetId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "The latest 100 releases for the release target",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      deployment: { $ref: "#/components/schemas/Deployment" },
                      version: {
                        $ref: "#/components/schemas/DeploymentVersion",
                      },
                      variables: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            value: { type: "string" },
                          },
                          required: ["key", "value"],
                        },
                      },
                    },
                    required: ["deployment", "version", "variables"],
                  },
                },
              },
            },
          },
          404: {
            description: "The release target was not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                  required: ["error"],
                },
              },
            },
          },
          500: {
            description: "An internal server error occurred",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
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
