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
  isPassingChannelSelectorPolicy,
  isPassingLockingPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const versionDeployRouter = createTRPCRouter({
  toEnvironment: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet, Permission.DeploymentVersionGet)
          .on(
            { type: "deploymentVersion", id: input.versionId },
            { type: "environment", id: input.environmentId },
          ),
    })
    .input(
      z.object({
        environmentId: z.string(),
        versionId: z.string(),
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
        .versions([input.versionId])
        .filter(
          input.isForcedRelease
            ? (_, releaseJobTriggers) => releaseJobTriggers
            : isPassingChannelSelectorPolicy,
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
            { type: "deploymentVersion", id: input.versionId },
            { type: "resource", id: input.resourceId },
          ),
    })
    .input(
      z.object({
        resourceId: z.string().uuid(),
        versionId: z.string().uuid(),
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
        .where(eq(SCHEMA.deploymentVersion.id, input.versionId))
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
        .versions([rel.id])
        .resources([t.id])
        .filter(
          input.isForcedRelease
            ? (_, releaseJobTriggers) => releaseJobTriggers
            : isPassingChannelSelectorPolicy,
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
