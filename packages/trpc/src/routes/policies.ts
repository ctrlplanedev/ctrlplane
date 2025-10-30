import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const policiesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policies",
        {
          params: {
            path: { workspaceId },
          },
        },
      );

      return result.data;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        policyId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, policyId } = input;

      // Get the policy first to send with the event
      const response = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policies/{policyId}",
        {
          params: {
            path: { workspaceId, policyId },
          },
        },
      );

      if (!response.data) {
        throw new Error("Policy not found");
      }

      const policy = response.data;

      // Send the delete event - the workspace engine will process it
      await sendGoEvent({
        workspaceId,
        eventType: Event.PolicyDeleted,
        timestamp: Date.now(),
        data: policy,
      });

      return policy;
    }),
});
