import type { Swagger } from "atlassian-openapi";

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
          deploymentSelector: { type: "object", additionalProperties: true },
          environmentSelector: { type: "object", additionalProperties: true },
          releaseSelector: { type: "object", additionalProperties: true },
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
            type: "array",
            items: { $ref: "#/components/schemas/VersionAnyApproval" },
          },
          versionUserApprovals: {
            type: "array",
            items: { $ref: "#/components/schemas/VersionUserApproval" },
          },
          versionRoleApprovals: {
            type: "array",
            items: { $ref: "#/components/schemas/VersionRoleApproval" },
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
        summary: "Create a policy",
        operationId: "createPolicy",
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
                    },
                    required: ["roleId"],
                  },
                },
                required: [
                  "name",
                  "workspaceId",
                  "targets",
                  "denyWindows",
                  "versionUserApprovals",
                  "versionRoleApprovals",
                ],
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
