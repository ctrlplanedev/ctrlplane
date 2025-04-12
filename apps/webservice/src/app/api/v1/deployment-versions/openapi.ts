import type { Swagger } from "atlassian-openapi";

import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployment-versions": {
      post: {
        summary: "Upserts a deployment version",
        operationId: "upsertDeploymentVersion",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tag: { type: "string" },
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
                    enum: Object.values(DeploymentVersionStatus),
                  },
                  message: { type: "string" },
                  metadata: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
                required: ["tag", "deploymentId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeploymentVersion" },
              },
            },
          },
          "409": {
            description: "Deployment version already exists",
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
