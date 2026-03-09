import { z } from "zod";

import { eq } from "@ctrlplane/db";
import {
  enqueueReleaseTargetsForDeployment,
  enqueueReleaseTargetsForEnvironment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

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

      const [record] = await ctx.db
        .insert(schema.userApprovalRecord)
        .values({
          userId,
          versionId: input.deploymentVersionId,
          environmentId: input.environmentId,
          status: input.status,
        })
        .onConflictDoUpdate({
          target: [
            schema.userApprovalRecord.versionId,
            schema.userApprovalRecord.userId,
            schema.userApprovalRecord.environmentId,
          ],
          set: {
            status: input.status,
            createdAt: new Date(),
          },
        })
        .returning();

      if (record != null)
        await enqueueReleaseTargetsForEnvironment(
          ctx.db,
          input.workspaceId,
          record.environmentId,
        );

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
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, versionId, status } = input;

      const [updated] = await ctx.db
        .update(schema.deploymentVersion)
        .set({ status })
        .where(eq(schema.deploymentVersion.id, versionId))
        .returning();

      if (!updated) throw new Error("Deployment version not found");

      await enqueueReleaseTargetsForDeployment(
        ctx.db,
        workspaceId,
        updated.deploymentId,
      );

      return updated;
    }),
});
