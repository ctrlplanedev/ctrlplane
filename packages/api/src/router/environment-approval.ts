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
        .from(SCHEMA.environmentPolicyApproval)
        .innerJoin(
          SCHEMA.environmentPolicy,
          eq(
            SCHEMA.environmentPolicy.id,
            SCHEMA.environmentPolicyApproval.policyId,
          ),
        )
        .leftJoin(
          SCHEMA.user,
          eq(SCHEMA.user.id, SCHEMA.environmentPolicyApproval.userId),
        )
        .where(
          and(
            ...[
              eq(SCHEMA.environmentPolicyApproval.releaseId, input.releaseId),
              input.status
                ? eq(SCHEMA.environmentPolicyApproval.status, input.status)
                : null,
            ].filter(isPresent),
          ),
        )
        .then((p) =>
          p.map((r) => ({
            ...r.environment_policy_approval,
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
      z.object({ policyId: z.string().uuid(), releaseId: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const envApproval = await ctx.db
        .update(SCHEMA.environmentPolicyApproval)
        .set({ status: "approved", userId: ctx.session.user.id })
        .where(
          and(
            eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
            eq(SCHEMA.environmentPolicyApproval.releaseId, input.releaseId),
          ),
        )
        .returning()
        .then(takeFirst);
      const releaseJobTriggers = await ctx.db
        .select()
        .from(SCHEMA.environmentPolicyApproval)
        .innerJoin(
          SCHEMA.environmentPolicy,
          eq(
            SCHEMA.environmentPolicy.id,
            SCHEMA.environmentPolicyApproval.policyId,
          ),
        )
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
        )
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.environmentId, SCHEMA.environment.id),
        )
        .innerJoin(
          SCHEMA.job,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.release.id),
        )
        .where(
          and(
            eq(SCHEMA.environmentPolicyApproval.id, envApproval.id),
            eq(SCHEMA.release.id, input.releaseId),
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
      z.object({ releaseId: z.string().uuid(), policyId: z.string().uuid() }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        await tx
          .update(SCHEMA.environmentPolicyApproval)
          .set({ status: "rejected", userId: ctx.session.user.id })
          .where(
            and(
              eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
              eq(SCHEMA.environmentPolicyApproval.releaseId, input.releaseId),
            ),
          );
        const updateResult = await tx.execute(
          sql`UPDATE job
                SET status = 'cancelled'
                FROM release_job_trigger rjt
                INNER JOIN environment env ON rjt.environment_id = env.id
                WHERE job.status = 'pending'
                  AND rjt.job_id = job.id
                  AND rjt.release_id = ${input.releaseId}
                  AND env.policy_id = ${input.policyId}`,
        );
        return { cancelledJobCount: updateResult.rowCount };
      }),
    ),
  statusByReleasePolicyId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "release", id: input.releaseId }),
    })
    .input(
      z.object({ releaseId: z.string().uuid(), policyId: z.string().uuid() }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.environmentPolicyApproval)
        .where(
          and(
            eq(SCHEMA.environmentPolicyApproval.releaseId, input.releaseId),
            eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
          ),
        )
        .then(takeFirstOrNull),
    ),
});
