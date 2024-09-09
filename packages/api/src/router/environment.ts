import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  arrayContains,
  eq,
  isNull,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createEnvironment,
  createEnvironmentPolicy,
  createEnvironmentPolicyDeployment,
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyApproval,
  environmentPolicyDeployment,
  environmentPolicyReleaseWindow,
  jobConfig,
  release,
  setPolicyReleaseWindow,
  system,
  target,
  targetProvider,
  updateEnvironment,
  updateEnvironmentPolicy,
} from "@ctrlplane/db/schema";
import {
  cancelOldJobConfigsOnJobDispatch,
  createJobConfigs,
  createJobExecutionApprovals,
  dispatchJobConfigs,
  isPassingAllPolicies,
  isPassingReleaseSequencingCancelPolicy,
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

        const jobConfigs = await ctx.db
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
          .innerJoin(jobConfig, eq(jobConfig.environmentId, environment.id))
          .where(
            and(
              eq(environmentPolicyApproval.id, envApproval.id),
              isNull(environment.deletedAt),
            ),
          );

        await dispatchJobConfigs(ctx.db)
          .jobConfigs(jobConfigs.map((t) => t.job_config))
          .filter(isPassingAllPolicies)
          .then(cancelOldJobConfigsOnJobDispatch)
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
      .mutation(async ({ ctx, input }) => {
        return ctx.db
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
  const env = await db
    .insert(environment)
    .values(input)
    .returning()
    .then(takeFirst);

  return db
    .update(environment)
    .set({ targetFilter: { "environment-id": env.id } })
    .where(eq(environment.id, env.id))
    .returning()
    .then(takeFirst);
};

const tragetRouter = createTRPCRouter({
  byEnvironmentId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "environment", id: input }),
    })
    .input(z.string())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(environment)
        .innerJoin(
          target,
          arrayContains(target.labels, environment.targetFilter),
        )
        .leftJoin(targetProvider, eq(targetProvider.id, target.providerId))
        .where(and(eq(environment.id, input), isNull(environment.deletedAt)))
        .then((d) =>
          d.map((d) => ({ ...d.target, provider: d.target_provider })),
        ),
    ),

  byFilter: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        labels: z.record(z.string()),
      }),
    )
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(target)
        .where(
          and(
            arrayContains(target.labels, input.labels),
            eq(target.workspaceId, input.workspaceId),
          ),
        ),
    ),
});

export const environmentRouter = createTRPCRouter({
  policy: policyRouter,

  target: tragetRouter,

  deploy: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environment", id: input.environmentId }),
    })
    .input(
      z.object({
        environmentId: z.string().uuid(),
        releaseId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { environmentId, releaseId } = input;
      const env = await ctx.db
        .select()
        .from(environment)
        .where(
          and(eq(environment.id, environmentId), isNull(environment.deletedAt)),
        )
        .then(takeFirstOrNull);
      if (!env) throw new Error("Environment not found");

      const rel = await ctx.db
        .select()
        .from(release)
        .innerJoin(deployment, eq(deployment.id, release.deploymentId))
        .where(eq(release.id, releaseId))
        .then(takeFirstOrNull);
      if (!rel) throw new Error("Release not found");

      const jobConfigs = await createJobConfigs(ctx.db, "redeploy")
        .causedById(ctx.session.user.id)
        .environments([env.id])
        .releases([rel.release.id])
        .filter(isPassingReleaseSequencingCancelPolicy)
        .then(createJobExecutionApprovals)
        .insert();

      await dispatchJobConfigs(ctx.db)
        .jobConfigs(jobConfigs)
        .filter(isPassingAllPolicies)
        .then(cancelOldJobConfigsOnJobDispatch)
        .dispatch();

      return {
        environment: env,
        release: { ...rel.release, deployment: rel.deployment },
        jobConfigs,
      };
    }),

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
        .leftJoin(
          target,
          and(
            arrayContains(target.labels, environment.targetFilter),
            eq(target.workspaceId, system.workspaceId),
          ),
        )
        .where(
          and(eq(environment.systemId, input), isNull(environment.deletedAt)),
        );

      return _.chain(envs)
        .groupBy((d) => d.environment.id)
        .map((envs) => ({
          ...envs.at(0)!.environment,
          targets: envs.map((e) => e.target).filter(isPresent),
        }))
        .value();
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
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(environment)
        .set(input.data)
        .where(eq(environment.id, input.id))
        .returning()
        .then(takeFirst)
        .then((env) =>
          createJobConfigs(ctx.db, "new_target")
            .environments([env.id])
            .filter(isPassingReleaseSequencingCancelPolicy)
            .then(createJobExecutionApprovals)
            .insert()
            .then((jobConfigs) =>
              dispatchJobConfigs(ctx.db)
                .jobConfigs(jobConfigs)
                .filter(isPassingAllPolicies)
                .then(cancelOldJobConfigsOnJobDispatch)
                .dispatch(),
            ),
        ),
    ),

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
