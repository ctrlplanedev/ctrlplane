import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";
import { getReleaseTarget } from "./utils";

export const pinVersion = protectedProcedure
  .input(
    z.object({
      releaseTargetId: z.string().uuid(),
      versionId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input.releaseTargetId,
      }),
  })
  .mutation(async ({ ctx, input }) => {
    const { releaseTargetId, versionId } = input;
    const releaseTarget = await getReleaseTarget(releaseTargetId);
    const version = await ctx.db
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, versionId))
      .then(takeFirst);

    await ctx.db
      .update(schema.releaseTarget)
      .set({ desiredVersionId: versionId })
      .where(eq(schema.releaseTarget.id, releaseTargetId));

    const versionEvaluateOptions = { versions: [version] };
    await dispatchQueueJob()
      .toEvaluate()
      .releaseTargets([releaseTarget], { versionEvaluateOptions });

    return version;
  });

export const unpinVersion = protectedProcedure
  .input(
    z.object({
      releaseTargetId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input.releaseTargetId,
      }),
  })
  .mutation(async ({ ctx, input }) => {
    const { releaseTargetId } = input;
    const releaseTarget = await getReleaseTarget(releaseTargetId);
    await ctx.db
      .update(schema.releaseTarget)
      .set({ desiredVersionId: null })
      .where(eq(schema.releaseTarget.id, releaseTargetId));

    await dispatchQueueJob().toEvaluate().releaseTargets([releaseTarget]);

    return;
  });
