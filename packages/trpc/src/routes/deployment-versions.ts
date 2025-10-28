import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";

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
});
