import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },

  paths: {
    "/v1/policies/{policyId}": {
      get: {
        summary: "Get a policy",
        operationId: "getPolicy",
        parameters: [
          {
            name: "policyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Policy" },
              },
            },
          },
          404: {
            description: "Policy not found",
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
            description: "Internal Server Error",
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
        },
      },

      patch: {
        summary: "Update a policy",
        operationId: "updatePolicy",
        parameters: [
          {
            name: "policyId",
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
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "number" },
                  enabled: { type: "boolean" },
                  workspaceId: { type: "string" },
                  targets: {
                    type: "array",
                    items: { $ref: "#/components/schemas/PolicyTarget" },
                  },
                  denyWindows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        timeZone: { type: "string" },
                        rrule: { type: "object", additionalProperties: true },
                        dtend: { type: "string", format: "date-time" },
                      },
                      required: ["timeZone"],
                    },
                  },
                  deploymentVersionSelector: {
                    $ref: "#/components/schemas/DeploymentVersionSelector",
                  },
                  versionAnyApprovals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        requiredApprovalsCount: { type: "number" },
                      },
                    },
                  },
                  versionUserApprovals: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/VersionUserApproval",
                    },
                  },
                  versionRoleApprovals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        roleId: { type: "string" },
                        requiredApprovalsCount: { type: "number" },
                      },
                      required: ["roleId"],
                    },
                  },
                  concurrency: {
                    $ref: "#/components/schemas/PolicyConcurrency",
                  },
                  environmentVersionRollout: {
                    $ref: "#/components/schemas/EnvironmentVersionRollout",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Policy" },
              },
            },
          },
          404: {
            description: "Policy not found",
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
            description: "Internal Server Error",
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
        },
      },

      delete: {
        summary: "Delete a policy",
        operationId: "deletePolicy",
        parameters: [
          {
            name: "policyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "number" },
                  },
                },
              },
            },
          },
          500: {
            description: "Internal Server Error",
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
        },
      },
    },
  },
};
