import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  eq,
  isNull,
  not,
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
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchJobsForNewTargets,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

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
          status: z.enum(["pending", "approved", "rejected"]),
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
          .where(
            and(
              eq(environmentPolicyApproval.releaseId, input.releaseId),
              eq(environmentPolicyApproval.status, input.status),
            ),
          )
          .then((p) =>
            p.map((r) => ({
              ...r.environment_policy_approval,
              policy: r.environment_policy,
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
          .update(environmentPolicyApproval)
          .set({ status: "approved" })
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
          .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
          .where(
            and(
              eq(environmentPolicyApproval.id, envApproval.id),
              isNull(environment.deletedAt),
              eq(release.id, input.releaseId),
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
      .mutation(async ({ ctx, input }) => {
        let cancelledJobsCount = 0;

        await ctx.db.transaction(async (tx) => {
          await tx
            .update(environmentPolicyApproval)
            .set({ status: "rejected" })
            .where(
              and(
                eq(environmentPolicyApproval.policyId, input.policyId),
                eq(environmentPolicyApproval.releaseId, input.releaseId),
              ),
            )
            .returning()
            .then(takeFirst);

          const jobIds = await tx
            .select({ id: job.id })
            .from(job)
            .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
            .innerJoin(
              environment,
              eq(releaseJobTrigger.environmentId, environment.id),
            )
            .where(
              and(
                eq(environment.policyId, input.policyId),
                eq(releaseJobTrigger.releaseId, input.releaseId),
                eq(job.status, "pending"),
              ),
            )
            .then((rows) => rows.map((row) => row.id));

          if (jobIds.length > 0) {
            await Promise.all(
              jobIds.map((jobId) =>
                tx
                  .update(job)
                  .set({ status: "cancelled" })
                  .where(eq(job.id, jobId)),
              ),
            );
            cancelledJobsCount = jobIds.length;
          }
        });

        return { cancelledJobsCount };
      }),

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
      ctx.db.query.environmentPolicy.findMany({
        where: eq(system.id, input),
        with: {},
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
        .where(and(eq(environment.id, input), isNull(environment.deletedAt)))
        .then(takeFirstOrNull)
        .then((env) =>
          env == null
            ? null
            : { ...env.environment, policy: env.environment_policy },
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

      await ctx.db
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
          .update(environment)
          .set({ deletedAt: new Date() })
          .where(eq(environment.id, input))
          .then(() =>
            db
              .delete(environmentPolicyDeployment)
              .where(eq(environmentPolicyDeployment.environmentId, input)),
          ),
      ),
    ),
});
