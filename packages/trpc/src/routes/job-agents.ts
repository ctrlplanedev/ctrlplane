import { v4 as uuidv4 } from "uuid";
import z from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

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
        config: z.record(z.string(), z.unknown()),
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
