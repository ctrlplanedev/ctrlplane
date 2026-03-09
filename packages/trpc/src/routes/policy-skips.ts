import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import { enqueueReleaseTargetsForEnvironment } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const policySkipsRouter = router({
  forEnvAndVersion: protectedProcedure
    .input(
      z.object({
        environmentId: z.string(),
        versionId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { environmentId, versionId } = input;
      return ctx.db.query.policySkip.findMany({
        where: and(
          eq(schema.policySkip.environmentId, environmentId),
          eq(schema.policySkip.versionId, versionId),
        ),
      });
    }),

  createForEnvAndVersion: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        environmentId: z.string(),
        versionId: z.string(),
        ruleId: z.string(),
        expiresAt: z.date().optional(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, environmentId, versionId, ruleId, expiresAt } =
        input;
      const userId = ctx.session.user.id;

      const [skip] = await ctx.db
        .insert(schema.policySkip)
        .values({
          createdBy: userId,
          environmentId,
          versionId,
          ruleId,
          expiresAt,
          reason: input.reason ?? "Skipped by user",
        })
        .returning();

      await enqueueReleaseTargetsForEnvironment(
        ctx.db,
        workspaceId,
        environmentId,
      );

      return skip;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        skipId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, skipId } = input;

      const [deleted] = await ctx.db
        .delete(schema.policySkip)
        .where(eq(schema.policySkip.id, skipId))
        .returning();

      if (!deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Skip not found" });

      if (deleted.environmentId != null)
        await enqueueReleaseTargetsForEnvironment(
          ctx.db,
          workspaceId,
          deleted.environmentId,
        );

      return deleted;
    }),
});
