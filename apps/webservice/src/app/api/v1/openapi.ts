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
      Workspace: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "The workspace ID",
          },
          name: { type: "string", description: "The name of the workspace" },
          slug: { type: "string", description: "The slug of the workspace" },
          googleServiceAccountEmail: {
            type: "string",
            description:
              "The email of the Google service account attached to the workspace",
            example: "ctrlplane@ctrlplane-workspace.iam.gserviceaccount.com",
            nullable: true,
          },
          awsRoleArn: {
            type: "string",
            description: "The ARN of the AWS role attached to the workspace",
            example: "arn:aws:iam::123456789012:role/ctrlplane-workspace-role",
            nullable: true,
          },
        },
        required: ["id", "name", "slug"],
      },
      System: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "The system ID" },
          workspaceId: {
            type: "string",
            format: "uuid",
            description: "The workspace ID of the system",
          },
          name: { type: "string", description: "The name of the system" },
          slug: { type: "string", description: "The slug of the system" },
          description: {
            type: "string",
            description: "The description of the system",
          },
        },
        required: ["id", "workspaceId", "name", "slug"],
      },
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
          retryCount: { type: "integer" },
          timeout: { type: "integer", nullable: true },
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
      UpdateDeployment: {
        type: "object",
        description: "Schema for updating a deployment (all fields optional)",
        allOf: [
          {
            $ref: "#/components/schemas/Deployment",
          },
          {
            type: "object",
            additionalProperties: true,
          },
        ],
        required: ["id"],
        additionalProperties: true,
      },
      Release: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          version: { type: "string" },
          config: { type: "object", additionalProperties: true },
          jobAgentConfig: { type: "object", additionalProperties: true },
          deploymentId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          metadata: { type: "object", additionalProperties: true },
        },
        required: [
          "id",
          "name",
          "version",
          "config",
          "deploymentId",
          "createdAt",
          "jobAgentConfig",
        ],
      },
      DeploymentVersion: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          tag: { type: "string" },
          config: { type: "object", additionalProperties: true },
          jobAgentConfig: { type: "object", additionalProperties: true },
          deploymentId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          metadata: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          status: { type: "string", enum: ["building", "ready", "failed"] },
        },
        required: [
          "id",
          "name",
          "tag",
          "config",
          "deploymentId",
          "createdAt",
          "jobAgentConfig",
        ],
      },
      Policy: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "The policy ID" },
          systemId: {
            type: "string",
            format: "uuid",
            description: "The system ID",
          },
          name: { type: "string", description: "The name of the policy" },
          description: {
            type: "string",
            nullable: true,
            description: "The description of the policy",
          },
          approvalRequirement: {
            type: "string",
            enum: ["manual", "automatic"],
            description: "The approval requirement of the policy",
          },
          successType: {
            type: "string",
            enum: ["some", "all", "optional"],
            description:
              "If a policy depends on an environment, whether or not the policy requires all, some, or optional successful releases in the environment",
          },
          successMinimum: {
            type: "number",
            description:
              "If a policy depends on an environment, the minimum number of successful releases in the environment",
          },
          concurrencyLimit: {
            type: "number",
            nullable: true,
            description:
              "The maximum number of concurrent releases in the environment",
          },
          rolloutDuration: {
            type: "number",
            description: "The duration of the rollout in milliseconds",
          },
          minimumReleaseInterval: {
            type: "number",
            description:
              "The minimum interval between releases in milliseconds",
          },
          releaseSequencing: {
            type: "string",
            enum: ["wait", "cancel"],
            description:
              "If a new release is created, whether it will wait for the current release to finish before starting, or cancel the current release",
          },
        },
        required: [
          "id",
          "systemId",
          "name",
          "approvalRequirement",
          "successType",
          "successMinimum",
          "rolloutDuration",
          "minimumReleaseInterval",
          "releaseSequencing",
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
          resourceSelector: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
          directory: {
            type: "string",
            description: "The directory path of the environment",
            example: "my/env/path",
            default: "",
          },
          createdAt: { type: "string", format: "date-time" },
          metadata: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          policy: { $ref: "#/components/schemas/Policy", nullable: true },
        },
        required: ["id", "systemId", "name", "createdAt", "directory"],
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
      ResourceWithVariables: {
        allOf: [
          { $ref: "#/components/schemas/Resource" },
          {
            properties: {
              variables: { $ref: "#/components/schemas/VariableMap" },
            },
          },
        ],
      },
      ResourceWithMetadata: {
        allOf: [
          { $ref: "#/components/schemas/Resource" },
          {
            properties: {
              metadata: { $ref: "#/components/schemas/MetadataMap" },
            },
          },
        ],
      },
      ResourceWithVariablesAndMetadata: {
        allOf: [
          { $ref: "#/components/schemas/ResourceWithVariables" },
          { $ref: "#/components/schemas/ResourceWithMetadata" },
        ],
      },
      JobStatus: {
        type: "string",
        enum: [
          "successful",
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
      Job: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/JobStatus" },
          externalId: {
            type: "string",
            nullable: true,
            description:
              "External job identifier (e.g. GitHub workflow run ID)",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          startedAt: { type: "string", format: "date-time", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
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
      MetadataMap: {
        type: "object",
        additionalProperties: {
          type: "string",
        },
      },
      VariableMap: {
        type: "object",
        additionalProperties: {
          nullable: true,
          oneOf: [
            { type: "string" },
            { type: "boolean" },
            { type: "number" },
            { type: "object" },
            { type: "array" },
          ],
        },
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
              { type: "object" },
              { type: "array" },
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
