import _ from "lodash";
import { z } from "zod";

import { and, eq, isNull, selector, takeFirstOrNull } from "@ctrlplane/db";
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
import { jobCondition } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const versionDeployRouter = createTRPCRouter({
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

  allJobsInDeployment: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        jobSelector: jobCondition.optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
        )
        .where(
          and(
            eq(SCHEMA.deploymentVersion.deploymentId, input.deploymentId),
            selector(ctx.db).query().jobs().where(input.jobSelector).sql(),
          ),
        );

      const triggers = await _.chain(rows)
        .groupBy((row) => [
          row.release_job_trigger.environmentId,
          row.release_job_trigger.versionId,
        ])
        .map((group) => {
          const { environmentId, versionId } = group[0]!.release_job_trigger;
          const resourceIds = group.map(
            (r) => r.release_job_trigger.resourceId,
          );
          return createReleaseJobTriggers(ctx.db, "force_deploy")
            .causedById(ctx.session.user.id)
            .environments([environmentId])
            .versions([versionId])
            .resources(resourceIds)
            .filter(isPassingChannelSelectorPolicy)
            .then(cancelPreviousJobsForRedeployedTriggers)
            .then(createJobApprovals)
            .insert();
        })
        .thru((promises) =>
          Promise.all(promises).then((triggers) => triggers.flat()),
        )
        .value();

      await dispatchReleaseJobTriggers(ctx.db)
        .releaseTriggers(triggers)
        .filter(isPassingAllPoliciesExceptNewerThanLastActive)
        .dispatch();

      return triggers;
    }),
});
