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
                        example: "123e4567-e89b-12d3-a456-426614174000",
                        description: "The ID of the version to pin",
                      },
                    },
                    required: ["versionId"],
                  },
                  {
                    type: "object",
                    properties: {
                      versionTag: {
                        type: "string",
                        example: "1.0.0",
                        description: "The tag of the version to pin",
                      },
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
