import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout":
      {
        get: {
          summary:
            "Get the rollout information across all release targets for a given deployment version and environment",
          operationId: "getRolloutInfo",
          parameters: [
            {
              name: "deploymentVersionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "The deployment version ID",
            },
            {
              name: "environmentId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "The environment ID",
            },
          ],
          responses: {
            200: {
              description: "The rollout information",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      allOf: [
                        { $ref: "#/components/schemas/ReleaseTarget" },
                        {
                          type: "object",
                          properties: {
                            rolloutTime: {
                              type: "string",
                              format: "date-time",
                              nullable: true,
                            },
                            rolloutPosition: { type: "number" },
                          },
                          required: ["rolloutTime", "rolloutPosition"],
                        },
                      ],
                    },
                  },
                },
              },
            },
            404: {
              description:
                "The deployment version or environment was not found",
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
