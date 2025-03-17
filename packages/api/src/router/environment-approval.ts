import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  eq,
  inArray,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
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
  byDeploymentVersionId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deploymentVersion", id: input.versionId }),
    })
    .input(
      z.object({
        versionId: z.string(),
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
              eq(
                SCHEMA.environmentPolicyApproval.deploymentVersionId,
                input.versionId,
              ),
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
          .on({ type: "deploymentVersion", id: input.versionId }),
    })
    .input(
      z.object({ policyId: z.string().uuid(), versionId: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const envApproval = await ctx.db
        .update(SCHEMA.environmentPolicyApproval)
        .set({ status: "approved", userId, approvedAt: sql`now()` })
        .where(
          and(
            eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
            eq(
              SCHEMA.environmentPolicyApproval.deploymentVersionId,
              input.versionId,
            ),
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
          SCHEMA.deploymentVersion,
          eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
        )
        .where(
          and(
            eq(SCHEMA.environmentPolicyApproval.id, envApproval.id),
            eq(SCHEMA.deploymentVersion.id, input.versionId),
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
          .on({ type: "deploymentVersion", id: input.versionId }),
    })
    .input(
      z.object({ versionId: z.string().uuid(), policyId: z.string().uuid() }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        await tx
          .update(SCHEMA.environmentPolicyApproval)
          .set({ status: "rejected", userId: ctx.session.user.id })
          .where(
            and(
              eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
              eq(
                SCHEMA.environmentPolicyApproval.deploymentVersionId,
                input.versionId,
              ),
            ),
          );

        const jobs = await tx
          .select()
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJobTrigger,
            eq(SCHEMA.job.id, SCHEMA.releaseJobTrigger.jobId),
          )
          .innerJoin(
            SCHEMA.environment,
            eq(SCHEMA.releaseJobTrigger.environmentId, SCHEMA.environment.id),
          )
          .where(
            and(
              eq(SCHEMA.job.status, JobStatus.Pending),
              eq(SCHEMA.releaseJobTrigger.versionId, input.versionId),
              eq(SCHEMA.environment.policyId, input.policyId),
            ),
          );

        await tx
          .update(SCHEMA.job)
          .set({ status: JobStatus.Cancelled })
          .where(
            inArray(
              SCHEMA.job.id,
              jobs.map((j) => j.job.id),
            ),
          );
        return { cancelledJobCount: jobs.length };
      }),
    ),
  statusByVersionPolicyId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deploymentVersion", id: input.versionId }),
    })
    .input(
      z.object({ versionId: z.string().uuid(), policyId: z.string().uuid() }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.environmentPolicyApproval)
        .where(
          and(
            eq(
              SCHEMA.environmentPolicyApproval.deploymentVersionId,
              input.versionId,
            ),
            eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
          ),
        )
        .then(takeFirstOrNull),
    ),
});
