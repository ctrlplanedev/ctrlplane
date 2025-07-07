import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/release-targets/{releaseTargetId}": {
      get: {
        summary: "Get a release target",
        operationId: "getReleaseTarget",
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
            description: "The release target",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReleaseTarget" },
              },
            },
          },
          404: {
            description: "Release target not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};
