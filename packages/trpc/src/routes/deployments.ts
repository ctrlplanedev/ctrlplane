import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

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
      console.log(response.data);
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
        limit: z.number().min(1).max(1000).default(1000),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/release-targets",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
              deploymentId: input.deploymentId,
            },
            query: { limit: input.limit, offset: input.offset },
          },
        },
      );
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
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId: _, ...deploymentData } = input;
      const deployment = { id: uuidv4(), ...deploymentData };

      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.DeploymentCreated,
        timestamp: Date.now(),
        data: { ...deployment, jobAgentConfig: {} },
      });

      return deployment;
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        data: z.object({
          resourceSelectorCel: z.string().min(1).max(255),
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
      const updateData = { ...deployment.data, resourceSelector };

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
        jobAgentConfig: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, jobAgentId, jobAgentConfig } = input;
      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data) throw new Error("Deployment not found");

      const maybeCleanGhConfig = (config: Record<string, unknown>) => {
        if (config.workflowId == null) return config;
        return { ...config, workflowId: Number(config.workflowId) };
      };

      const cleanConfig = maybeCleanGhConfig(jobAgentConfig);
      const updateData = {
        ...deployment.data,
        jobAgentId,
        jobAgentConfig: cleanConfig,
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
