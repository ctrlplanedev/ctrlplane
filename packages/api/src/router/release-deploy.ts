import { z } from "zod";

import { and, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  cancelPreviousJobsForRedeployedTriggers,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPoliciesExceptNewerThanLastActive,
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
          .perform(Permission.DeploymentGet, Permission.DeploymentVersionGet)
          .on(
            { type: "deploymentVersion", id: input.releaseId },
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
        .then(cancelPreviousJobsForRedeployedTriggers)
        .then(input.isForcedRelease ? () => {} : createJobApprovals)
        .insert();

      await dispatchReleaseJobTriggers(ctx.db)
        .releaseTriggers(releaseJobTriggers)
        .filter(
          input.isForcedRelease
            ? isPassingLockingPolicy
            : isPassingAllPoliciesExceptNewerThanLastActive,
        )
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();

      return releaseJobTriggers;
    }),

  toResource: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionGet, Permission.ResourceUpdate)
          .on(
            { type: "deploymentVersion", id: input.releaseId },
            { type: "resource", id: input.resourceId },
          ),
    })
    .input(
      z.object({
        resourceId: z.string().uuid(),
        releaseId: z.string().uuid(),
        environmentId: z.string().uuid(),
        isForcedRelease: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db
        .select()
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.id, input.resourceId),
            isNull(SCHEMA.resource.deletedAt),
          ),
        )
        .then(takeFirstOrNull);
      if (!t) throw new Error("Resource not found");

      if (t.lockedAt != null) throw new Error("Resource is locked");

      const rel = await ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .where(eq(SCHEMA.deploymentVersion.id, input.releaseId))
        .then(takeFirstOrNull);
      if (!rel) throw new Error("Release not found");

      const env = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, input.environmentId))
        .then(takeFirstOrNull);
      if (!env) throw new Error("Environment not found");

      const releaseJobTriggers = await createReleaseJobTriggers(
        ctx.db,
        "force_deploy",
      )
        .causedById(ctx.session.user.id)
        .environments([env.id])
        .releases([rel.id])
        .resources([t.id])
        .filter(
          input.isForcedRelease
            ? (_, releaseJobTriggers) => releaseJobTriggers
            : isPassingReleaseStringCheckPolicy,
        )
        .then(cancelPreviousJobsForRedeployedTriggers)
        .then(input.isForcedRelease ? () => {} : createJobApprovals)
        .insert();

      await dispatchReleaseJobTriggers(ctx.db)
        .releaseTriggers(releaseJobTriggers)
        .filter(
          input.isForcedRelease
            ? isPassingLockingPolicy
            : isPassingAllPoliciesExceptNewerThanLastActive,
        )
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();

      return releaseJobTriggers[0]!;
    }),
});
