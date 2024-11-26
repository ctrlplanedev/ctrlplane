import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {},
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
    },
    schemas: {
      Deployment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          systemId: { type: "string", format: "uuid" },
          jobAgentId: { type: "string", format: "uuid", nullable: true },
          jobAgentConfig: { type: "object", additionalProperties: true },
        },
        required: [
          "id",
          "name",
          "slug",
          "description",
          "systemId",
          "jobAgentConfig",
        ],
      },
      Release: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          version: { type: "string" },
          config: { type: "object", additionalProperties: true },
          deploymentId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "name",
          "version",
          "config",
          "deploymentId",
          "createdAt",
        ],
      },
      Environment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          systemId: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          policyId: { type: "string", format: "uuid", nullable: true },
          resourceFilter: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
          createdAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time", nullable: true },
        },
        required: ["id", "systemId", "name", "createdAt"],
      },
      Runbook: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          systemId: { type: "string", format: "uuid" },
          jobAgentId: { type: "string", format: "uuid" },
        },
        required: ["id", "name", "systemId", "jobAgentId"],
      },
      Resource: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          version: { type: "string" },
          kind: { type: "string" },
          identifier: { type: "string" },
          config: { type: "object", additionalProperties: true },
          metadata: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          workspaceId: { type: "string", format: "uuid" },
        },
        required: [
          "id",
          "name",
          "version",
          "kind",
          "identifier",
          "config",
          "workspaceId",
          "createdAt",
          "updatedAt",
          "metadata",
        ],
      },
      Job: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: [
              "completed",
              "cancelled",
              "skipped",
              "in_progress",
              "action_required",
              "pending",
              "failure",
              "invalid_job_agent",
              "invalid_integration",
              "external_run_not_found",
            ],
          },
          externalId: {
            type: "string",
            nullable: true,
            description:
              "External job identifier (e.g. GitHub workflow run ID)",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          jobAgentId: { type: "string", format: "uuid" },
          jobAgentConfig: {
            type: "object",
            description: "Configuration for the Job Agent",
            additionalProperties: true,
          },
          message: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "status", "createdAt", "updatedAt", "jobAgentConfig"],
      },
      Variable: {
        type: "object",
        required: ["key", "value"],
        properties: {
          key: {
            type: "string",
          },
          value: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
            ],
          },
          sensitive: {
            type: "boolean",
          },
        },
      },
    },
  },
};
