import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createEnvironmentPolicy,
  createEnvironmentPolicyDeployment,
  environment,
  environmentPolicy,
  environmentPolicyApproval,
  environmentPolicyDeployment,
  environmentPolicyReleaseChannel,
  environmentPolicyReleaseWindow,
  job,
  release,
  releaseChannel,
  releaseJobTrigger,
  setPolicyReleaseWindow,
  updateEnvironmentPolicy,
  user,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const policyRouter = createTRPCRouter({
  deployment: createTRPCRouter({
    bySystemId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemGet)
            .on({ type: "system", id: input }),
      })
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .select()
          .from(environmentPolicyDeployment)
          .innerJoin(
            environmentPolicy,
            eq(environmentPolicy.id, environmentPolicyDeployment.policyId),
          )
          .where(eq(environmentPolicy.systemId, input))
          .then((d) => d.map((d) => d.environment_policy_deployment)),
      ),

    create: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemUpdate)
            .on({ type: "environment", id: input.environmentId }),
      })
      .input(createEnvironmentPolicyDeployment)
      .mutation(({ ctx, input }) =>
        ctx.db
          .insert(environmentPolicyDeployment)
          .values([input])
          .returning()
          .then(takeFirst),
      ),

    delete: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemUpdate)
            .on({ type: "environment", id: input.environmentId }),
      })
      .input(
        z.object({
          policyId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db
          .delete(environmentPolicyDeployment)
          .where(
            and(
              eq(environmentPolicyDeployment.policyId, input.policyId),
              eq(
                environmentPolicyDeployment.environmentId,
                input.environmentId,
              ),
            ),
          )
          .returning()
          .then(takeFirst),
      ),
  }),

  approval: createTRPCRouter({
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
          .from(environmentPolicyApproval)
          .innerJoin(
            environmentPolicy,
            eq(environmentPolicy.id, environmentPolicyApproval.policyId),
          )
          .leftJoin(user, eq(user.id, environmentPolicyApproval.userId))
          .where(
            and(
              ...[
                eq(environmentPolicyApproval.releaseId, input.releaseId),
                input.status
                  ? eq(environmentPolicyApproval.status, input.status)
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
        z.object({
          policyId: z.string().uuid(),
          releaseId: z.string().uuid(),
          userId: z.string().uuid(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const envApproval = await ctx.db
          .update(environmentPolicyApproval)
          .set({ status: "approved", userId: input.userId })
          .where(
            and(
              eq(environmentPolicyApproval.policyId, input.policyId),
              eq(environmentPolicyApproval.releaseId, input.releaseId),
            ),
          )
          .returning()
          .then(takeFirst);

        const releaseJobTriggers = await ctx.db
          .select()
          .from(environmentPolicyApproval)
          .innerJoin(
            environmentPolicy,
            eq(environmentPolicy.id, environmentPolicyApproval.policyId),
          )
          .innerJoin(
            environment,
            eq(environment.policyId, environmentPolicy.id),
          )
          .innerJoin(
            releaseJobTrigger,
            eq(releaseJobTrigger.environmentId, environment.id),
          )
          .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
          .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
          .where(
            and(
              eq(environmentPolicyApproval.id, envApproval.id),
              isNull(environment.deletedAt),
              eq(release.id, input.releaseId),
              eq(job.status, JobStatus.Pending),
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
          policyId: z.string().uuid(),
          userId: z.string().uuid(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db.transaction(async (tx) => {
          await tx
            .update(environmentPolicyApproval)
            .set({ status: "rejected", userId: input.userId })
            .where(
              and(
                eq(environmentPolicyApproval.policyId, input.policyId),
                eq(environmentPolicyApproval.releaseId, input.releaseId),
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
          .from(environmentPolicyApproval)
          .where(
            and(
              eq(environmentPolicyApproval.releaseId, input.releaseId),
              eq(environmentPolicyApproval.policyId, input.policyId),
            ),
          )
          .then(takeFirstOrNull),
      ),
  }),

  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(environmentPolicy)
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(eq(environmentPolicy.systemId, input))
        .then((policies) =>
          _.chain(policies)
            .groupBy("environment_policy.id")
            .map((p) => ({
              ...p[0]!.environment_policy,
              releaseWindows: p
                .map((t) => t.environment_policy_release_window)
                .filter(isPresent),
            }))
            .value(),
        ),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "environmentPolicy", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(environmentPolicy)
        .leftJoin(
          environmentPolicyReleaseChannel,
          eq(environmentPolicyReleaseChannel.policyId, environmentPolicy.id),
        )
        .leftJoin(
          releaseChannel,
          eq(environmentPolicyReleaseChannel.channelId, releaseChannel.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(eq(environmentPolicy.id, input))
        .then((rows) => {
          const policy = rows.at(0)!;
          const releaseChannels = _.chain(rows)
            .map((r) => r.release_channel)
            .filter(isPresent)
            .uniqBy((r) => r.id)
            .value();

          const releaseWindows = _.chain(rows)
            .map((r) => r.environment_policy_release_window)
            .filter(isPresent)
            .map((r) => ({
              ...r,
              startTime: new Date(r.startTime),
              endTime: new Date(r.endTime),
            }))
            .value();

          return {
            ...policy.environment_policy,
            releaseChannels,
            releaseWindows,
          };
        }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createEnvironmentPolicy)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (db) =>
        db.insert(environmentPolicy).values(input).returning().then(takeFirst),
      ),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environmentPolicy", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateEnvironmentPolicy }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(environmentPolicy)
        .set(input.data)
        .where(eq(environmentPolicy.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  updateReleaseChannels: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        releaseChannels: z.record(z.string().uuid().nullable()),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environmentPolicy", id: input.id }),
    })
    .mutation(({ ctx, input }) => {
      const { id, releaseChannels } = input;
      const [nulled, set] = _.partition(
        Object.entries(releaseChannels),
        ([_, channelId]) => channelId == null,
      );

      const nulledIds = nulled.map(([deploymentId]) => deploymentId);
      const setChannels = set.map(([deploymentId, channelId]) => ({
        policyId: id,
        deploymentId,
        channelId: channelId!,
      }));

      return ctx.db.transaction(async (db) => {
        await db
          .delete(environmentPolicyReleaseChannel)
          .where(
            inArray(environmentPolicyReleaseChannel.deploymentId, nulledIds),
          );

        if (setChannels.length > 0)
          await db
            .insert(environmentPolicyReleaseChannel)
            .values(setChannels)
            .onConflictDoUpdate({
              target: [
                environmentPolicyReleaseChannel.policyId,
                environmentPolicyReleaseChannel.deploymentId,
              ],
              set: buildConflictUpdateColumns(environmentPolicyReleaseChannel, [
                "channelId",
              ]),
            });
      });
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environmentPolicy", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(environmentPolicy)
        .where(eq(environmentPolicy.id, input))
        .returning()
        .then(takeFirst),
    ),

  setWindows: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environmentPolicy", id: input.policyId }),
    })
    .input(
      z.object({
        policyId: z.string().uuid(),
        releaseWindows: z.array(setPolicyReleaseWindow),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(environmentPolicyReleaseWindow)
        .where(eq(environmentPolicyReleaseWindow.policyId, input.policyId))
        .then(() =>
          input.releaseWindows.length === 0
            ? []
            : ctx.db
                .insert(environmentPolicyReleaseWindow)
                .values(input.releaseWindows)
                .returning(),
        ),
    ),
});
