import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/release-targets/{releaseTargetId}/pin": {
      post: {
        summary: "Pin a version to a release target",
        operationId: "pinReleaseTarget",
        parameters: [
          {
            name: "releaseTargetId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      versionId: {
                        type: "string",
                        format: "uuid",
                        nullable: true,
                      },
                    },
                    required: ["versionId"],
                  },
                  {
                    type: "object",
                    properties: {
                      versionTag: { type: "string", nullable: true },
                    },
                    required: ["versionTag"],
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Version pinned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
              },
            },
          },
          400: {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          404: {
            description: "Version not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          500: {
            description: "Internal server error",
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
