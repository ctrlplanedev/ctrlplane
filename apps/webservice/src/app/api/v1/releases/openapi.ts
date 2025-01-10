import type { Swagger } from "atlassian-openapi";

import { ReleaseStatus } from "@ctrlplane/validators/releases";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/releases": {
      post: {
        summary: "Upserts a release",
        operationId: "upsertRelease",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  version: { type: "string" },
                  deploymentId: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                  name: { type: "string" },
                  config: { type: "object", additionalProperties: true },
                  status: {
                    type: "string",
                    enum: Object.values(ReleaseStatus),
                  },
                  message: { type: "string" },
                  metadata: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
                required: ["version", "deploymentId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    version: { type: "string" },
                    metadata: {
                      $ref: "#/components/schemas/Release/properties/metadata",
                    },
                  },
                },
              },
            },
          },
          "409": {
            description: "Release already exists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    id: { type: "string" },
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
