import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const workflowsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        workflowTemplateId: z.string(),
        inputs: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, workflowTemplateId, inputs } = input;

      await sendGoEvent({
        workspaceId,
        eventType: Event.WorkflowCreated,
        data: {
          id: uuidv4(),
          workflowTemplateId,
          inputs,
        },
        timestamp: Date.now(),
      });
    }),
  templates: router({
    get: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          workflowTemplateId: z.string(),
        }),
      )
      .query(async ({ input }) => {
        const { workspaceId, workflowTemplateId } = input;
        const result = await getClientFor(workspaceId).GET(
          "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
          {
            params: {
              path: { workspaceId, workflowTemplateId },
            },
          },
        );

        if (result.error != null)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get workflow template",
          });
        return result.data;
      }),

    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        const { workspaceId } = input;
        const result = await getClientFor(workspaceId).GET(
          "/v1/workspaces/{workspaceId}/workflow-templates",
          {
            params: {
              path: { workspaceId },
              query: { limit: input.limit, offset: input.offset },
            },
          },
        );

        if (result.error != null)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to list workflow templates",
          });
        return result.data;
      }),

    workflows: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          workflowTemplateId: z.string(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        const { workspaceId, workflowTemplateId, limit, offset } = input;
        const result = await getClientFor(workspaceId).GET(
          "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}/workflows",
          {
            params: {
              path: { workspaceId, workflowTemplateId },
              query: { limit, offset },
            },
          },
        );

        if (result.error != null)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to list workflows",
          });
        return result.data;
      }),
  }),
});
