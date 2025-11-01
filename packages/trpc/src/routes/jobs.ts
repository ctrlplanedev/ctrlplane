import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const jobsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const jobs = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/jobs",
        {
          params: {
            path: { workspaceId: input.workspaceId },
          },
        },
      );

      return jobs.data;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        jobId: z.string(),
        status: z.enum([
          "cancelled",
          "skipped",
          "inProgress",
          "actionRequired",
          "pending",
          "failure",
          "invalidJobAgent",
          "invalidIntegration",
          "externalRunNotFound",
          "successful",
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, jobId, status } = input;
      const jobResponse = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/jobs/{jobId}",
        { params: { path: { workspaceId, jobId } } },
      );

      if (jobResponse.data == null) throw new Error("Job not found");
      const updatedJob = { ...jobResponse.data, status };
      if (
        status === "successful" ||
        status === "failure" ||
        status === "cancelled" ||
        status === "skipped" ||
        status === "externalRunNotFound" ||
        status === "invalidJobAgent" ||
        status === "invalidIntegration"
      ) {
        updatedJob.completedAt = new Date().toISOString();
      }

      await sendGoEvent({
        workspaceId,
        eventType: Event.JobUpdated,
        timestamp: Date.now(),
        data: {
          id: jobId,
          job: updatedJob,
          fieldsToUpdate: ["status", "completedAt"],
          agentId: jobResponse.data.jobAgentId,
          externalId: jobResponse.data.externalId,
        },
      });

      return updatedJob;
    }),
});
