import type { Swagger } from "atlassian-openapi";

import { ReleaseStatus } from "@ctrlplane/validators/releases";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/releases/{releaseId}": {
      patch: {
        summary: "Updates a release",
        operationId: "updateRelease",
        parameters: [
          {
            name: "releaseId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The release ID",
          },
        ],
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
                  jobAgentConfig: {
                    type: "object",
                    additionalProperties: true,
                  },
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
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Release" },
              },
            },
          },
        },
      },
    },
  },
};
