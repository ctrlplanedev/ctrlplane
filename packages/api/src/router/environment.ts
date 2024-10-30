import type { Tx } from "@ctrlplane/db";
import type { EnvironmentPolicyReleaseWindow } from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  eq,
  isNull,
  not,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createEnvironment,
  createEnvironmentPolicy,
  createEnvironmentPolicyDeployment,
  environment,
  environmentPolicy,
  environmentPolicyApproval,
  environmentPolicyDeployment,
  environmentPolicyReleaseWindow,
  job,
  release,
  releaseJobTrigger,
  setPolicyReleaseWindow,
  system,
  target,
  targetMatchesMetadata,
  updateEnvironment,
  updateEnvironmentPolicy,
  user,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchJobsForNewTargets,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const policyRouter = createTRPCRouter({
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const envApproval = await ctx.db
          .update(environmentPolicyApproval)
          .set({ status: "approved", userId: ctx.session.user.id })
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
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db.transaction(async (tx) => {
          await tx
            .update(environmentPolicyApproval)
            .set({ status: "rejected", userId: ctx.session.user.id })
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
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          environmentPolicy: environmentPolicy,
          releaseWindows: sql<EnvironmentPolicyReleaseWindow[]>`
          COALESCE(
            array_agg(
              CASE WHEN ${environmentPolicyReleaseWindow.id} IS NOT NULL
              THEN json_build_object(
                'id', ${environmentPolicyReleaseWindow.id},
                'policyId', ${environmentPolicyReleaseWindow.policyId},
                'recurrence', ${environmentPolicyReleaseWindow.recurrence},
                'startTime', ${environmentPolicyReleaseWindow.startTime},
                'endTime', ${environmentPolicyReleaseWindow.endTime}
              )
              ELSE NULL END
            ) FILTER (WHERE ${environmentPolicyReleaseWindow.id} IS NOT NULL),
            ARRAY[]::json[]
          )
        `.as("releaseWindows"),
        })
        .from(environmentPolicy)
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(eq(environmentPolicy.id, input))
        .groupBy(environmentPolicy.id)
        .then(takeFirst)
        .then((p) => ({
          ...p.environmentPolicy,
          releaseWindows: p.releaseWindows.map((r) => ({
            ...r,
            startTime: new Date(r.startTime),
            endTime: new Date(r.endTime),
          })),
        })),
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

export const createEnv = async (
  db: Tx,
  input: z.infer<typeof createEnvironment>,
) => {
  return db.insert(environment).values(input).returning().then(takeFirst);
};

export const environmentRouter = createTRPCRouter({
  policy: policyRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(environment)
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .innerJoin(system, eq(environment.systemId, system.id))
        .where(and(eq(environment.id, input), isNull(environment.deletedAt)))
        .then(takeFirstOrNull)
        .then((env) =>
          env == null
            ? null
            : {
                ...env.environment,
                policy: env.environment_policy,
                system: env.system,
              },
        ),
    ),

  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const envs = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(system.id, environment.systemId))
        .orderBy(environment.name)
        .where(
          and(eq(environment.systemId, input), isNull(environment.deletedAt)),
        );

      return await Promise.all(
        envs.map(async (e) => ({
          ...e.environment,
          system: e.system,
          targets:
            e.environment.targetFilter != null
              ? await ctx.db
                  .select()
                  .from(target)
                  .where(
                    targetMatchesMetadata(ctx.db, e.environment.targetFilter),
                  )
              : [],
        })),
      );
    }),

  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(environment.systemId, system.id))
        .where(eq(system.workspaceId, input))
        .orderBy(environment.name)
        .then((envs) =>
          envs.map((e) => ({ ...e.environment, system: e.system })),
        ),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemCreate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createEnvironment)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction((db) => createEnv(db, input)),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environment", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateEnvironment }))
    .mutation(async ({ ctx, input }) => {
      const oldEnv = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(system.id, environment.systemId))
        .where(eq(environment.id, input.id))
        .then(takeFirst);

      const updatedEnv = await ctx.db
        .update(environment)
        .set(input.data)
        .where(eq(environment.id, input.id))
        .returning()
        .then(takeFirst);

      const { targetFilter } = input.data;
      const isUpdatingTargetFilter = targetFilter != null;
      if (isUpdatingTargetFilter) {
        const hasTargetFiltersChanged = !_.isEqual(
          oldEnv.environment.targetFilter,
          targetFilter,
        );

        if (hasTargetFiltersChanged) {
          const oldQuery = targetMatchesMetadata(
            ctx.db,
            oldEnv.environment.targetFilter,
          );
          const newTargets = await ctx.db
            .select({ id: target.id })
            .from(target)
            .where(
              and(
                eq(target.workspaceId, oldEnv.system.workspaceId),
                targetMatchesMetadata(ctx.db, targetFilter),
                oldQuery && not(oldQuery),
              ),
            );

          if (newTargets.length > 0) {
            await dispatchJobsForNewTargets(
              ctx.db,
              newTargets.map((t) => t.id),
              input.id,
            );
            console.log(
              `Found ${newTargets.length} new targets for environment ${input.id}`,
            );
          }
        }
      }

      return updatedEnv;
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemDelete)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.transaction((db) =>
        db
          .delete(environment)
          .where(eq(environment.id, input))
          .returning()
          .then(takeFirst),
      ),
    ),
});
