import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const environmentRouter = router({
  get: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), environmentId: z.string() }))
    .query(async ({ input }) => {
      const { workspaceId, environmentId } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}",
        { params: { path: { workspaceId, environmentId } } },
      );

      if (!result.data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      return result.data;
    }),

  resources: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, environmentId, limit, offset } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}/resources",
        {
          params: {
            path: { workspaceId, environmentId },
            query: { limit, offset },
          },
        },
      );

      return result.data;
    }),

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, environmentId, limit, offset } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}/release-targets",
        {
          params: {
            path: { workspaceId, environmentId },
            query: { limit, offset },
          },
        },
      );
      return result.data;
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ input }) => {
      const { workspaceId } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments",
        {
          params: { query: { limit: 1000, offset: 0 }, path: { workspaceId } },
        },
      );

      return result.data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
        metadata: z.record(z.string(), z.string()).optional(),
        data: z.object({
          resourceSelectorCel: z.string().min(1).max(255),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, environmentId, data } = input;
      const validate = await getClientFor(workspaceId).POST(
        "/v1/validate/resource-selector",
        {
          body: {
            resourceSelector: {
              cel: data.resourceSelectorCel,
            },
          },
        },
      );

      if (!validate.data?.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
            validate.data.errors.length > 0
              ? validate.data.errors.join(", ")
              : "Invalid resource selector",
        });
      }

      const env = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}",
        { params: { path: { workspaceId, environmentId } } },
      );

      if (!env.data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      const updateData = {
        ...env.data,
        resourceSelector: {
          cel: data.resourceSelectorCel,
        },
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentUpdated,
        timestamp: Date.now(),
        data: updateData,
      });

      return env.data;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        systemIds: z.array(z.string()).min(1),
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
        metadata: z.record(z.string(), z.string()).optional(),
        resourceSelectorCel: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ input }) => {
      const validate = await getClientFor(input.workspaceId).POST(
        "/v1/validate/resource-selector",
        {
          body: {
            resourceSelector: {
              cel: input.resourceSelectorCel,
            },
          },
        },
      );

      if (!validate.data?.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
            validate.data.errors.length > 0
              ? validate.data.errors.join(", ")
              : "Invalid resource selector",
        });
      }

      const { workspaceId, ...environmentData } = input;
      const environment = {
        id: uuidv4(),
        ...environmentData,
        description: environmentData.description ?? "",
        createdAt: new Date().toISOString(),
        resourceSelector: {
          cel: environmentData.resourceSelectorCel,
        },
        metadata: input.metadata ?? {},
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentCreated,
        timestamp: Date.now(),
        data: environment,
      });

      return environment;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, environmentId } = input;

      const env = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}",
        { params: { path: { workspaceId, environmentId } } },
      );

      if (!env.data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentDeleted,
        timestamp: Date.now(),
        data: env.data,
      });

      return { success: true };
    }),
});
