import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const deploymentVersionsRouter = router({
  approve: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        deploymentVersionId: z.string(),
        environmentId: z.string(),
        status: z.enum(["approved", "rejected"]).default("approved"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const record: WorkspaceEngine["schemas"]["UserApprovalRecord"] = {
        userId,
        versionId: input.deploymentVersionId,
        environmentId: input.environmentId,
        status: input.status,
        createdAt: new Date().toISOString(),
      };

      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.UserApprovalRecordCreated,
        timestamp: Date.now(),
        data: record,
      });

      return record;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        versionId: z.string().uuid(),
        status: z.enum([
          "building",
          "ready",
          "failed",
          "rejected",
          "paused",
          "unspecified",
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, versionId, status } = input;
      const deploymentVersionId = versionId;
      const client = getClientFor(workspaceId);
      const versionResponse = await client.GET(
        "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}",
        { params: { path: { workspaceId, deploymentVersionId } } },
      );
      if (versionResponse.error != null)
        throw new Error(versionResponse.error.error);

      const { data: version } = versionResponse;
      const updatedVersion = { ...version, status };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentVersionUpdated,
        timestamp: Date.now(),
        data: updatedVersion,
      });
    }),
});
