import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  notInArray,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createRelease,
  deployment,
  environment,
  environmentPolicy,
  job,
  release,
  releaseDependency,
  releaseJobTrigger,
  releaseMatchesCondition,
  releaseMetadata,
  system,
  target,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingLockingPolicy,
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { releaseCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseList)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.string(),
        filter: releaseCondition.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const deploymentIdCheck = eq(release.deploymentId, input.deploymentId);
      const releaseConditionCheck = releaseMatchesCondition(
        ctx.db,
        input.filter,
      );
      const checks = [deploymentIdCheck, releaseConditionCheck].filter(
        isPresent,
      );

      const items = ctx.db
        .select()
        .from(release)
        .leftJoin(
          releaseDependency,
          eq(release.id, releaseDependency.releaseId),
        )
        .where(
          and(
            ...[
              eq(release.deploymentId, input.deploymentId),
              releaseMatchesCondition(ctx.db, input.filter),
            ].filter(isPresent),
          ),
        )
        .orderBy(desc(release.createdAt), desc(release.version))
        .limit(input.limit ?? 1000)
        .offset(input.offset ?? 0)
        .then((data) =>
          _.chain(data)
            .groupBy("release.id")
            .map((r) => ({
              ...r[0]!.release,
              releaseDependencies: r
                .map((rd) => rd.release_dependency)
                .filter(isPresent),
            }))
            .value(),
        );

      const total = ctx.db
        .select({
          count: count().mapWith(Number),
        })
        .from(release)
        .where(and(...checks))
        .then(takeFirst)
        .then((t) => t.count);

      return Promise.all([items, total]).then(([items, total]) => ({
        items,
        total,
      }));
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseGet)
          .on({ type: "release", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(release)
        .leftJoin(deployment, eq(release.deploymentId, deployment.id))
        .leftJoin(
          releaseDependency,
          eq(releaseDependency.releaseId, release.id),
        )
        .where(eq(release.id, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.release.id)
            .map((r) => ({
              ...r[0]!.release,
              dependencies: r
                .filter(isPresent)
                .map((r) => r.release_dependency!),
            }))
            .value()
            .at(0),
        )
        .then(async (data) => {
          if (data == null) return null;
          return {
            ...data,
            metadata: Object.fromEntries(
              await ctx.db
                .select()
                .from(releaseMetadata)
                .where(eq(releaseMetadata.releaseId, data.id))
                .then((r) => r.map((k) => [k.key, k.value])),
            ),
          };
        }),
    ),

  deploy: createTRPCRouter({
    toEnvironment: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.DeploymentGet, Permission.ReleaseGet)
            .on(
              { type: "release", id: input.releaseId },
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
        const cancelPreviousJobs = async (
          tx: Tx,
          releaseJobTriggers: ReleaseJobTrigger[],
        ) =>
          tx
            .select()
            .from(releaseJobTrigger)
            .where(
              and(
                eq(releaseJobTrigger.releaseId, input.releaseId),
                eq(releaseJobTrigger.environmentId, input.environmentId),
                notInArray(
                  releaseJobTrigger.id,
                  releaseJobTriggers.map((j) => j.id),
                ),
              ),
            )
            .then((existingReleaseJobTriggers) =>
              tx
                .update(job)
                .set({ status: "cancelled" })
                .where(
                  inArray(
                    job.id,
                    existingReleaseJobTriggers.map((t) => t.jobId),
                  ),
                )
                .then(() => {}),
            );

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
          .then(input.isForcedRelease ? cancelPreviousJobs : createJobApprovals)
          .insert();

        await dispatchReleaseJobTriggers(ctx.db)
          .releaseTriggers(releaseJobTriggers)
          .filter(
            input.isForcedRelease
              ? isPassingLockingPolicy
              : isPassingAllPolicies,
          )
          .then(cancelOldReleaseJobTriggersOnJobDispatch)
          .dispatch();

        return releaseJobTriggers;
      }),

    toTarget: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.ReleaseGet, Permission.TargetUpdate)
            .on(
              { type: "release", id: input.releaseId },
              { type: "target", id: input.targetId },
            ),
      })
      .input(
        z.object({
          targetId: z.string().uuid(),
          releaseId: z.string().uuid(),
          environmentId: z.string().uuid(),
          isForcedRelease: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const t = await ctx.db
          .select()
          .from(target)
          .where(eq(target.id, input.targetId))
          .then(takeFirstOrNull);
        if (!t) throw new Error("Target not found");

        if (t.lockedAt != null) throw new Error("Target is locked");

        const rel = await ctx.db
          .select()
          .from(release)
          .where(eq(release.id, input.releaseId))
          .then(takeFirstOrNull);
        if (!rel) throw new Error("Release not found");

        const env = await ctx.db
          .select()
          .from(environment)
          .where(eq(environment.id, input.environmentId))
          .then(takeFirstOrNull);
        if (!env) throw new Error("Environment not found");

        const releaseJobTriggers = await createReleaseJobTriggers(
          ctx.db,
          "force_deploy",
        )
          .causedById(ctx.session.user.id)
          .environments([env.id])
          .releases([rel.id])
          .targets([t.id])
          .filter(
            input.isForcedRelease
              ? (_, releaseJobTriggers) => releaseJobTriggers
              : isPassingReleaseStringCheckPolicy,
          )
          .then(input.isForcedRelease ? () => {} : createJobApprovals)
          .insert();

        await dispatchReleaseJobTriggers(ctx.db)
          .releaseTriggers(releaseJobTriggers)
          .filter(
            input.isForcedRelease
              ? isPassingLockingPolicy
              : isPassingAllPolicies,
          )
          .then(cancelOldReleaseJobTriggersOnJobDispatch)
          .dispatch();
      }),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseCreate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(createRelease)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (db) => {
        const rel = await db
          .insert(release)
          .values(input)
          .returning()
          .then(takeFirst);

        const releaseDeps = input.releaseDependencies.map((rd) => ({
          ...rd,
          releaseId: rel.id,
        }));
        await db.insert(releaseDependency).values(releaseDeps);

        const releaseJobTriggers = await createReleaseJobTriggers(
          db,
          "new_release",
        )
          .causedById(ctx.session.user.id)
          .filter(isPassingReleaseStringCheckPolicy)
          .releases([rel.id])
          .then(createJobApprovals)
          .insert();

        await dispatchReleaseJobTriggers(db)
          .releaseTriggers(releaseJobTriggers)
          .filter(isPassingAllPolicies)
          .then(cancelOldReleaseJobTriggersOnJobDispatch)
          .dispatch();

        return { ...rel, releaseJobTriggers };
      }),
    ),

  blocked: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseGet).on(
          ...(input as string[]).map((t) => ({
            type: "release" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .query(async ({ input }) => {
      const policies = await db
        .select()
        .from(release)
        .innerJoin(deployment, eq(release.deploymentId, deployment.id))
        .innerJoin(environment, eq(deployment.systemId, environment.systemId))
        .innerJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .where(
          and(
            inArray(release.id, input),
            isNotNull(environmentPolicy.releaseFilter),
          ),
        );

      const blockedEnvironments = await Promise.all(
        policies.map(
          async ({ release: rel, environment, environment_policy }) => {
            const { releaseFilter } = environment_policy;
            if (releaseFilter == null) return null;

            const r = await db
              .select()
              .from(release)
              .where(
                and(
                  eq(release.id, rel.id),
                  releaseMatchesCondition(db, releaseFilter),
                ),
              )
              .then(takeFirstOrNull);

            return r != null
              ? null
              : {
                  releaseId: rel.id,
                  environmentId: environment.id,
                };
          },
        ),
      ).then((r) => r.filter(isPresent));

      return blockedEnvironments.reduce(
        (acc, { releaseId, environmentId }) => {
          if (!acc[releaseId]) acc[releaseId] = [];
          acc[releaseId].push(environmentId);
          return acc;
        },
        {} as Record<string, string[]>,
      );
    }),

  metadataKeys: createTRPCRouter({
    bySystem: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.ReleaseGet).on({
            type: "system",
            id: input,
          }),
      })
      .input(z.string().uuid())
      .query(async ({ input, ctx }) =>
        ctx.db
          .selectDistinct({ key: releaseMetadata.key })
          .from(release)
          .innerJoin(releaseMetadata, eq(releaseMetadata.releaseId, release.id))
          .innerJoin(deployment, eq(release.deploymentId, deployment.id))
          .where(eq(deployment.systemId, input))
          .then((r) => r.map((row) => row.key)),
      ),

    byWorkspace: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.ReleaseGet).on({
            type: "workspace",
            id: input,
          }),
      })
      .input(z.string().uuid())
      .query(async ({ input, ctx }) =>
        ctx.db
          .selectDistinct({ key: releaseMetadata.key })
          .from(release)
          .innerJoin(releaseMetadata, eq(releaseMetadata.releaseId, release.id))
          .innerJoin(deployment, eq(release.deploymentId, deployment.id))
          .innerJoin(system, eq(deployment.systemId, system.id))
          .where(eq(system.workspaceId, input))
          .then((r) => r.map((row) => row.key)),
      ),
  }),
});
