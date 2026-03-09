import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import z from "zod";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const jobAgentConfig = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("github-app"),
    installationId: z.number(),
    owner: z.string(),
  }),
  z.object({
    type: z.literal("argo-cd"),
    apiKey: z.string(),
    serverUrl: z.string(),
  }),
  z
    .object({
      type: z.literal("tfe"),
      address: z.string(),
      organization: z.string(),
      token: z.string(),
      template: z.string().optional(),
    })
    .passthrough(),
  z.object({
    type: z.literal("test-runner"),
    delaySeconds: z.number().optional(),
    message: z.string().optional(),
    status: z.enum(["completed", "failure"]).optional(),
  }),
  z.object({ type: z.literal("custom") }).passthrough(),
]);

export const jobAgentsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input }) => {
      const jobAgents = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/job-agents",
        {
          params: { path: { workspaceId: input.workspaceId } },
        },
      );
      return jobAgents.data;
    }),

  get: protectedProcedure
    .input(z.object({ jobAgentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const jobAgent = await ctx.db.query.jobAgent.findFirst({
        where: eq(schema.jobAgent.id, input.jobAgentId),
      });
      if (jobAgent == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job agent not found",
        });
      return jobAgent;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        name: z.string(),
        type: z.string(),
        config: jobAgentConfig,
      }),
    )
    .mutation(async ({ input }) => {
      const data = { ...input, id: uuidv4() };
      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.JobAgentCreated,
        timestamp: Date.now(),
        data,
      });
      return data;
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), jobAgentId: z.string() }))
    .mutation(async ({ input: { jobAgentId }, ctx }) => {
      const [jobAgent] = await ctx.db
        .delete(schema.jobAgent)
        .where(eq(schema.jobAgent.id, jobAgentId))
        .returning();

      if (jobAgent == null) throw new Error("Job agent not found");

      return jobAgent;
    }),

  deployments: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), jobAgentId: z.string() }))
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/deployments",
        {
          params: {
            path: input,
            query: { limit: 1000, offset: 0 },
          },
        },
      );

      if (response.error != null)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: response.error.error,
        });

      return response.data;
    }),
});
