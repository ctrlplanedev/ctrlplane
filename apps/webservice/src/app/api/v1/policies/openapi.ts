import type { Swagger } from "atlassian-openapi";

import * as schema from "@ctrlplane/db/schema";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      PolicyTarget: {
        type: "object",
        properties: {
          deploymentSelector: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
          environmentSelector: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
          resourceSelector: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
        },
      },
      DenyWindow: {
        type: "object",
        properties: {
          timeZone: { type: "string" },
          rrule: { type: "object", additionalProperties: true },
          dtend: { type: "string", format: "date-time" },
        },
        required: ["timeZone", "rrule"],
      },
      DeploymentVersionSelector: {
        type: "object",
        properties: {
          name: { type: "string" },
          deploymentVersionSelector: {
            type: "object",
            additionalProperties: true,
          },
          description: { type: "string" },
        },
        required: ["name", "deploymentVersionSelector"],
      },
      VersionAnyApproval: {
        type: "object",
        properties: { requiredApprovalsCount: { type: "number" } },
        required: ["requiredApprovalsCount"],
      },
      VersionUserApproval: {
        type: "object",
        properties: { userId: { type: "string" } },
        required: ["userId"],
      },
      VersionRoleApproval: {
        type: "object",
        properties: {
          roleId: { type: "string" },
          requiredApprovalsCount: { type: "number" },
        },
        required: ["roleId", "requiredApprovalsCount"],
      },
      PolicyConcurrency: {
        type: "integer",
        nullable: true,
        minimum: 1,
        format: "int32",
      },
      EnvironmentVersionRollout: {
        type: "object",
        properties: {
          positionGrowthFactor: {
            type: "number",
            description:
              "Controls how strongly queue position influences delay — higher values result in a smoother, slower rollout curve.",
          },
          timeScaleInterval: {
            type: "number",
            description:
              "Defines the base time interval that each unit of rollout progression is scaled by — larger values stretch the deployment timeline.",
          },
          rolloutType: {
            type: "string",
            enum: Object.keys(schema.apiRolloutTypeToDBRolloutType),
            description:
              "Determines the shape of the rollout curve — linear, exponential, or normalized versions of each. A normalized rollout curve limits the maximum delay to the time scale interval, and scales the rollout progression to fit within that interval.",
          },
        },
        required: ["positionGrowthFactor", "timeScaleInterval", "rolloutType"],
      },
      Policy: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          priority: { type: "number" },
          createdAt: { type: "string", format: "date-time" },
          enabled: { type: "boolean" },
          workspaceId: { type: "string", format: "uuid" },
          targets: {
            type: "array",
            items: { $ref: "#/components/schemas/PolicyTarget" },
          },
          denyWindows: {
            type: "array",
            items: { $ref: "#/components/schemas/DenyWindow" },
          },
          deploymentVersionSelector: {
            $ref: "#/components/schemas/DeploymentVersionSelector",
          },
          versionAnyApprovals: {
            $ref: "#/components/schemas/VersionAnyApproval",
          },
          versionUserApprovals: {
            type: "array",
            items: { $ref: "#/components/schemas/VersionUserApproval" },
          },
          versionRoleApprovals: {
            type: "array",
            items: { $ref: "#/components/schemas/VersionRoleApproval" },
          },
          concurrency: {
            $ref: "#/components/schemas/PolicyConcurrency",
          },
          environmentVersionRollout: {
            $ref: "#/components/schemas/EnvironmentVersionRollout",
          },
        },
        required: [
          "id",
          "name",
          "priority",
          "createdAt",
          "enabled",
          "workspaceId",
          "targets",
          "denyWindows",
          "versionUserApprovals",
          "versionRoleApprovals",
        ],
      },
    },
  },
  paths: {
    "/v1/policies": {
      post: {
        summary: "Upsert a policy",
        operationId: "upsertPolicy",
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
                    $ref: "#/components/schemas/VersionAnyApproval",
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
                      $ref: "#/components/schemas/VersionRoleApproval",
                    },
                  },
                  concurrency: {
                    $ref: "#/components/schemas/PolicyConcurrency",
                  },
                },
                required: ["name", "workspaceId", "targets"],
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
