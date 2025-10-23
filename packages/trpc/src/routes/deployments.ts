import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

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
      const response = await wsEngine.GET(
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
      const response = await wsEngine.GET(
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
      const response = await wsEngine.GET(
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
      const response = await wsEngine.GET(
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
        workspaceId: z.string().uuid(),
        systemId: z.string(),
        name: z.string().min(3).max(255),
        slug: z.string().min(3).max(255),
        description: z.string().max(255).optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
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
});
