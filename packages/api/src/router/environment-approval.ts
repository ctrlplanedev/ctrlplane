import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const approvalRouter = createTRPCRouter({
  byReleaseId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "release", id: input.releaseId }),
    })
    .input(
      z.object({
        releaseId: z.string(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.environmentApproval)
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.environmentApproval.environmentId, SCHEMA.environment.id),
        )
        .innerJoin(
          SCHEMA.environmentPolicy,
          eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
        )
        .leftJoin(
          SCHEMA.user,
          eq(SCHEMA.user.id, SCHEMA.environmentApproval.userId),
        )
        .where(
          and(
            ...[
              eq(SCHEMA.environmentApproval.releaseId, input.releaseId),
              input.status
                ? eq(SCHEMA.environmentApproval.status, input.status)
                : null,
            ].filter(isPresent),
          ),
        )
        .orderBy(SCHEMA.environment.name)
        .then((p) =>
          p.map((r) => ({
            ...r.environment_approval,
            policy: r.environment_policy,
            user: r.user,
          })),
        ),
    ),

  approve: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "release", id: input.releaseId }),
    })
    .input(
      z.object({
        environmentId: z.string().uuid(),
        releaseId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(SCHEMA.environmentApproval)
        .set({ status: "approved", userId: ctx.session.user.id })
        .where(
          and(
            eq(SCHEMA.environmentApproval.environmentId, input.environmentId),
            eq(SCHEMA.environmentApproval.releaseId, input.releaseId),
          ),
        )
        .returning()
        .then(takeFirst);

      const releaseJobTriggers = await ctx.db
        .select()
        .from(SCHEMA.releaseJobTrigger)
        .innerJoin(
          SCHEMA.job,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, input.environmentId),
            eq(SCHEMA.releaseJobTrigger.releaseId, input.releaseId),
            eq(SCHEMA.job.status, JobStatus.Pending),
          ),
        );

      await dispatchReleaseJobTriggers(ctx.db)
        .releaseTriggers(releaseJobTriggers.map((t) => t.release_job_trigger))
        .filter(isPassingAllPolicies)
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();
    }),

  reject: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "release", id: input.releaseId }),
    })
    .input(
      z.object({
        releaseId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        await tx
          .update(SCHEMA.environmentApproval)
          .set({ status: "rejected", userId: ctx.session.user.id })
          .where(
            and(
              eq(SCHEMA.environmentApproval.environmentId, input.environmentId),
              eq(SCHEMA.environmentApproval.releaseId, input.releaseId),
            ),
          );

        const updateResult = await tx.execute(
          sql`UPDATE job
              SET status = 'cancelled'
              FROM release_job_trigger rjt
              WHERE job.status = 'pending'
                AND rjt.job_id = job.id
                AND rjt.release_id = ${input.releaseId}
                AND rjt.environment_id = ${input.environmentId}`,
        );

        return { cancelledJobCount: updateResult.rowCount };
      }),
    ),

  statusByReleaseEnvironmentId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "release", id: input.releaseId }),
    })
    .input(
      z.object({
        releaseId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.environmentApproval)
        .where(
          and(
            eq(SCHEMA.environmentApproval.releaseId, input.releaseId),
            eq(SCHEMA.environmentApproval.environmentId, input.environmentId),
          ),
        )
        .then(takeFirstOrNull),
    ),
});
