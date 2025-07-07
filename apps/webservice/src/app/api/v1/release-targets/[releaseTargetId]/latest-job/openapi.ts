import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/release-targets/{releaseTargetId}/latest-job": {
      get: {
        summary: "Get the latest successful job for a release target",
        operationId: "getLatestJob",
        parameters: [
          {
            name: "releaseTargetId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "The release target ID",
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/JobWithTrigger",
                },
              },
            },
          },
          "404": {
            description: "Not Found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Job not found.",
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Internal server error.",
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
