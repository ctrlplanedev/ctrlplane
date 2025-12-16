import { v4 as uuidv4 } from "uuid";
import z from "zod";

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
    .input(z.object({ workspaceId: z.uuid(), jobAgentId: z.string() }))
    .query(async ({ input }) => {
      const jobAgent = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
              jobAgentId: input.jobAgentId,
            },
          },
        },
      );
      return jobAgent.data;
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
    .mutation(async ({ input: { workspaceId, jobAgentId } }) => {
      const jobAgentResponse = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
        { params: { path: { workspaceId, jobAgentId } } },
      );
      if (jobAgentResponse.error != null)
        throw new Error(jobAgentResponse.error.error);
      await sendGoEvent({
        workspaceId,
        eventType: Event.JobAgentDeleted,
        timestamp: Date.now(),
        data: jobAgentResponse.data,
      });
      return jobAgentResponse.data;
    }),
});
