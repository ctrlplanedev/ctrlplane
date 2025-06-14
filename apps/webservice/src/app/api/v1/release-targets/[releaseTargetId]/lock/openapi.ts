import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      ReleaseTargetLockRecord: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          releaseTargetId: { type: "string", format: "uuid" },
          lockedAt: { type: "string", format: "date-time" },
          unlockedAt: { type: "string", format: "date-time", nullable: true },
          lockedBy: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string" },
            },
            required: ["id", "email"],
          },
        },
        required: [
          "id",
          "releaseTargetId",
          "lockedAt",
          "unlockedAt",
          "lockedBy",
        ],
      },
    },
  },
  paths: {
    "/v1/release-targets/{releaseTargetId}/lock": {
      post: {
        summary: "Lock a release target",
        operationId: "lockReleaseTarget",
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
            description: "Release target locked",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ReleaseTargetLockRecord",
                },
              },
            },
          },
          409: {
            description: "Release target is already locked",
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
