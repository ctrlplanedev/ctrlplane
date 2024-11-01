import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { z } from "zod";

import { and, eq, inArray, notInArray, takeFirstOrNull } from "@ctrlplane/db";
import {
  environment,
  job,
  release,
  releaseJobTrigger,
  target,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingLockingPolicy,
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseDeployRouter = createTRPCRouter({
  toEnvironment: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet, Permission.ReleaseGet)
          .on(
            { type: "release", id: input.releaseId },
            { type: "environment", id: input.environmentId },
          ),
    })
    .input(
      z.object({
        environmentId: z.string(),
        releaseId: z.string(),
        isForcedRelease: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cancelPreviousJobs = async (
        tx: Tx,
        releaseJobTriggers: ReleaseJobTrigger[],
      ) =>
        tx
          .select()
          .from(releaseJobTrigger)
          .where(
            and(
              eq(releaseJobTrigger.releaseId, input.releaseId),
              eq(releaseJobTrigger.environmentId, input.environmentId),
              notInArray(
                releaseJobTrigger.id,
                releaseJobTriggers.map((j) => j.id),
              ),
            ),
          )
          .then((existingReleaseJobTriggers) =>
            tx
              .update(job)
              .set({ status: "cancelled" })
              .where(
                inArray(
                  job.id,
                  existingReleaseJobTriggers.map((t) => t.jobId),
                ),
              )
              .then(() => {}),
          );

      const releaseJobTriggers = await createReleaseJobTriggers(
        ctx.db,
        "force_deploy",
      )
        .causedById(ctx.session.user.id)
        .environments([input.environmentId])
        .releases([input.releaseId])
        .filter(
          input.isForcedRelease
            ? (_, releaseJobTriggers) => releaseJobTriggers
            : isPassingReleaseStringCheckPolicy,
        )
        .then(input.isForcedRelease ? cancelPreviousJobs : createJobApprovals)
        .insert();

      await dispatchReleaseJobTriggers(ctx.db)
        .releaseTriggers(releaseJobTriggers)
        .filter(
          input.isForcedRelease ? isPassingLockingPolicy : isPassingAllPolicies,
        )
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();

      return releaseJobTriggers;
    }),

  toTarget: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseGet, Permission.TargetUpdate)
          .on(
            { type: "release", id: input.releaseId },
            { type: "target", id: input.targetId },
          ),
    })
    .input(
      z.object({
        targetId: z.string().uuid(),
        releaseId: z.string().uuid(),
        environmentId: z.string().uuid(),
        isForcedRelease: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db
        .select()
        .from(target)
        .where(eq(target.id, input.targetId))
        .then(takeFirstOrNull);
      if (!t) throw new Error("Target not found");

      if (t.lockedAt != null) throw new Error("Target is locked");

      const rel = await ctx.db
        .select()
        .from(release)
        .where(eq(release.id, input.releaseId))
        .then(takeFirstOrNull);
      if (!rel) throw new Error("Release not found");

      const env = await ctx.db
        .select()
        .from(environment)
        .where(eq(environment.id, input.environmentId))
        .then(takeFirstOrNull);
      if (!env) throw new Error("Environment not found");

      const releaseJobTriggers = await createReleaseJobTriggers(
        ctx.db,
        "force_deploy",
      )
        .causedById(ctx.session.user.id)
        .environments([env.id])
        .releases([rel.id])
        .targets([t.id])
        .filter(
          input.isForcedRelease
            ? (_, releaseJobTriggers) => releaseJobTriggers
            : isPassingReleaseStringCheckPolicy,
        )
        .then(input.isForcedRelease ? () => {} : createJobApprovals)
        .insert();

      await dispatchReleaseJobTriggers(ctx.db)
        .releaseTriggers(releaseJobTriggers)
        .filter(
          input.isForcedRelease ? isPassingLockingPolicy : isPassingAllPolicies,
        )
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();

      return releaseJobTriggers[0]!;
    }),
});
