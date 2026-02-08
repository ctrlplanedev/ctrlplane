import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const deploymentGhConfig = z.object({
  repo: z.string(),
  workflowId: z.coerce.number(),
  ref: z.string().optional(),
});

const deploymentArgoCdConfig = z.object({
  template: z.string(),
});

const deploymentTfeConfig = z.object({
  template: z.string(),
});

const deploymentCustomConfig = z.object({}).passthrough();

const deploymentJobAgentConfig = z.union([
  deploymentGhConfig,
  deploymentArgoCdConfig,
  deploymentTfeConfig,
  deploymentCustomConfig,
]);

export const deploymentsRouter = router({
  get: protectedProcedure
    .input(z.object({ workspaceId: z.string(), deploymentId: z.string() }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
              deploymentId: input.deploymentId,
            },
          },
        },
      );
      return response.data;
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments",
        {
          params: {
            path: { workspaceId: input.workspaceId },
            query: { limit: 1000, offset: 0 },
          },
        },
      );
      return response.data;
    }),

  releaseTargets: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseTargetGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string(),
        deploymentId: z.string(),
        query: z.string().optional(),
        limit: z.number().min(1).max(1000).default(1000),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, deploymentId, query, limit, offset } = input;
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/release-targets",
        {
          params: {
            path: { workspaceId, deploymentId },
            query: { limit, offset, query },
          },
        },
      );

      if (response.error != null)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            response.error.error ??
            "Failed to get release targets for deployment",
        });

      return response.data;
    }),

  versions: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string(),
        deploymentId: z.string(),
        limit: z.number().min(1).max(1000).default(1000),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
        {
          params: {
            path: input,
            query: { limit: 5_000, offset: 0 },
          },
        },
      );

      return response.data;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        systemId: z.string(),
        name: z.string().min(3).max(255),
        slug: z.string().min(3).max(255),
        description: z.string().max(255).optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId: _, ...deploymentData } = input;
      const deployment = { id: uuidv4(), ...deploymentData };

      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.DeploymentCreated,
        timestamp: Date.now(),
        data: {
          ...deployment,
          jobAgentConfig: {},
          metadata: input.metadata ?? {},
        },
      });

      return deployment;
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        data: z.object({
          resourceSelectorCel: z.string().min(1).max(512),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, data } = input;
      const validate = await getClientFor(workspaceId).POST(
        "/v1/validate/resource-selector",
        {
          body: { resourceSelector: { cel: data.resourceSelectorCel } },
        },
      );

      if (!validate.data?.valid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
              validate.data.errors.length > 0
              ? validate.data.errors.join(", ")
              : "Invalid resource selector",
        });

      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      const resourceSelector = { cel: data.resourceSelectorCel };
      const updateData: WorkspaceEngine["schemas"]["Deployment"] = {
        ...deployment.data.deployment,
        resourceSelector,
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentUpdated,
        timestamp: Date.now(),
        data: updateData,
      });

      return deployment.data;
    }),

  updateJobAgent: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        jobAgentId: z.string(),
        jobAgentConfig: deploymentJobAgentConfig,
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, jobAgentId, jobAgentConfig } = input;
      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data) throw new Error("Deployment not found");

      const getTypedJobAgentConfig = (
        config: z.infer<typeof deploymentJobAgentConfig>,
      ) => {
        const ghResult = deploymentGhConfig.safeParse(config);
        if (ghResult.success) {
          return { ...ghResult.data, type: "github-app" as const };
        }
        const argoCdResult = deploymentArgoCdConfig.safeParse(config);
        if (argoCdResult.success) {
          return { ...argoCdResult.data, type: "argo-cd" as const };
        }
        const tfeResult = deploymentTfeConfig.safeParse(config);
        if (tfeResult.success) {
          return { ...tfeResult.data, type: "tfe" as const };
        }
        return { ...config, type: "custom" as const };
      };

      const updateData: WorkspaceEngine["schemas"]["Deployment"] = {
        ...deployment.data.deployment,
        jobAgentId,
        jobAgentConfig: getTypedJobAgentConfig(jobAgentConfig),
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentUpdated,
        timestamp: Date.now(),
        data: updateData,
      });

      return updateData;
    }),

  createVersion: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        tag: z.string().min(1),
        name: z.string().optional(),
        status: z
          .enum(["building", "ready", "failed", "rejected"])
          .default("ready"),
        message: z.string().optional(),
        config: z.record(z.string(), z.any()).default({}),
        jobAgentConfig: z.record(z.string(), z.any()).default({}),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ input }) => {
      const { workspaceId, ...versionData } = input;
      const version = {
        id: uuidv4(),
        ...versionData,
        name: versionData.name ?? versionData.tag,
        metadata: {} as Record<string, string>,
        createdAt: new Date().toISOString(),
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentVersionCreated,
        timestamp: Date.now(),
        data: version,
      });

      return version;
    }),

  deleteVariable: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        deploymentId: z.string(),
        variableId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, variableId } = input;

      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      const variable = deployment.data.variables.find(
        (v) => v.variable.id === variableId,
      );

      if (!variable)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment variable not found",
        });

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentVariableDeleted,
        timestamp: Date.now(),
        data: variable.variable,
      });

      return { success: true };
    }),

  policies: protectedProcedure
    .input(z.object({ workspaceId: z.string(), deploymentId: z.string() }))
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/policies",
        {
          params: {
            path: input,
          },
        },
      );
      return response.data?.items ?? [];
    }),
});
