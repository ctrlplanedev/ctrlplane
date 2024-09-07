import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, desc, eq, inArray, ne, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createRelease,
  deployment,
  environment,
  environmentPolicy,
  release,
  releaseDependency,
} from "@ctrlplane/db/schema";
import {
  cancelOldJobConfigsOnJobDispatch,
  createJobConfigs,
  createJobExecutionApprovals,
  dispatchJobConfigs,
  isPassingAllPolicies,
  isPassingEnvironmentPolicy,
  isPassingReleaseSequencingCancelPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
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
          .perform(Permission.DeploymentGet)
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
            .perform(Permission.DeploymentGet)
            .on(
              { type: "release", id: input.releaseId },
              { type: "environment", id: input.environmentId },
            ),
      })
      .input(z.object({ environmentId: z.string(), releaseId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const jobConfigs = await createJobConfigs(ctx.db, "redeploy")
          .causedById(ctx.session.user.id)
          .environments([input.environmentId])
          .releases([input.releaseId])
          .filter(isPassingReleaseSequencingCancelPolicy)
          .insert();

        await dispatchJobConfigs(ctx.db)
          .jobConfigs(jobConfigs)
          .filter(isPassingAllPolicies)
          .then(cancelOldJobConfigsOnJobDispatch)
          .dispatch();

        return jobConfigs;
      }),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
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

        const jobConfigs = await createJobConfigs(db, "new_release")
          .causedById(ctx.session.user.id)
          .filter(isPassingEnvironmentPolicy)
          .releases([rel.id])
          .filter(isPassingReleaseSequencingCancelPolicy)
          .then(createJobExecutionApprovals)
          .insert();

        await dispatchJobConfigs(db)
          .jobConfigs(jobConfigs)
          .filter(isPassingAllPolicies)
          .then(cancelOldJobConfigsOnJobDispatch)
          .dispatch();

        return { ...rel, jobConfigs };
      }),
    ),

  blockedEnvironments: protectedProcedure
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
