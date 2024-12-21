import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/environments/{environmentId}": {
      get: {
        summary: "Get an environment",
        operationId: "getEnvironment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the environment",
          },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    systemId: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string", nullable: true },
                    resourceFilter: {
                      type: "object",
                      additionalProperties: true,
                    },
                    policyId: { type: "string", nullable: true },
                    expiresAt: { type: "string", format: "date-time" },
                    createdAt: { type: "string", format: "date-time" },
                    releaseChannels: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          deploymentId: { type: "string" },
                          channelId: { type: "string" },
                          environmentId: { type: "string" },
                        },
                      },
                    },
                    policy: {
                      type: "object",
                      nullable: true,
                      properties: {
                        systemId: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string", nullable: true },
                        id: { type: "string" },
                        approvalRequirement: {
                          type: "string",
                          enum: ["manual", "automatic"],
                        },
                        successType: {
                          type: "string",
                          enum: ["some", "all", "optional"],
                        },
                        successMinimum: { type: "number" },
                        concurrencyLimit: { type: "number", nullable: true },
                        rolloutDuration: { type: "number" },
                        releaseSequencing: {
                          type: "string",
                          enum: ["wait", "cancel"],
                        },
                      },
                    },
                  },
                  required: [
                    "systemId",
                    "name",
                    "id",
                    "createdAt",
                    "releaseChannels",
                  ],
                },
              },
            },
          },
          "404": {
            description: "Environment not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string", example: "Environment not found" },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },

      delete: {
        summary: "Delete an environment",
        operationId: "deleteEnvironment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the environment",
          },
        ],
        responses: {
          "200": {
            description: "Environment deleted successfully",
          },
        },
      },
    },
  },
};
