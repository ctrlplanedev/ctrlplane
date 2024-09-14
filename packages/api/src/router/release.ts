import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  desc,
  eq,
  inArray,
  ne,
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
  release,
  releaseDependency,
  releaseJobTrigger,
  target,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  createTriggeredReleaseJobs,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingEnvironmentPolicy,
  isPassingLockingPolicy,
  isPassingReleaseSequencingCancelPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

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
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(release)
        .leftJoin(
          releaseDependency,
          eq(release.id, releaseDependency.releaseId),
        )
        .where(eq(release.deploymentId, input.deploymentId))
        .orderBy(desc(release.createdAt))
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
        ),
    ),

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
        ),
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
              createTriggeredReleaseJobs(
                tx,
                existingReleaseJobTriggers,
                "cancelled",
              ).then(() => {}),
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
              ? (_tx, releaseJobTriggers) => releaseJobTriggers
              : isPassingReleaseSequencingCancelPolicy,
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

        const jc = await ctx.db
          .select()
          .from(releaseJobTrigger)
          .where(
            and(
              eq(releaseJobTrigger.releaseId, input.releaseId),
              eq(releaseJobTrigger.environmentId, input.environmentId),
              eq(releaseJobTrigger.targetId, input.targetId),
            ),
          )
          .then(takeFirstOrNull);

        const releaseJobTriggers =
          jc != null
            ? [jc]
            : await createReleaseJobTriggers(ctx.db, "force_deploy")
                .causedById(ctx.session.user.id)
                .environments([env.id])
                .releases([rel.id])
                .targets([t.id])
                .filter(
                  input.isForcedRelease
                    ? (_tx, releaseJobTriggers) => releaseJobTriggers
                    : isPassingReleaseSequencingCancelPolicy,
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

        if (input.releaseDependencies.length > 0)
          await db.insert(releaseDependency).values(
            input.releaseDependencies.map((rd) => ({
              ...rd,
              releaseId: rel.id,
            })),
          );

        const releaseJobTriggers = await createReleaseJobTriggers(
          db,
          "new_release",
        )
          .causedById(ctx.session.user.id)
          .filter(isPassingEnvironmentPolicy)
          .releases([rel.id])
          .filter(isPassingReleaseSequencingCancelPolicy)
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

  blockedEnvironments: protectedProcedure
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
            ne(environmentPolicy.evaluateWith, "none"),
          ),
        );

      return policies.reduce(
        (acc, { release, environment, environment_policy }) => {
          if (!acc[release.id]) acc[release.id] = [];

          const isInvalidSemver =
            environment_policy.evaluateWith === "semver" &&
            !satisfies(release.version, environment_policy.evaluate);
          const isInvalidRegex =
            environment_policy.evaluateWith === "regex" &&
            !new RegExp(environment_policy.evaluate).test(release.version);

          if (isInvalidSemver || isInvalidRegex)
            acc[release.id]!.push(environment.id);

          return acc;
        },
        {} as Record<string, string[]>,
      );
    }),
});
