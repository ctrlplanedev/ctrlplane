import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const createForceDeployment = async (
  db: Tx,
  releaseTarget: schema.ReleaseTarget,
) =>
  db.transaction(async (tx) => {
    const existingRelease = await tx
      .select()
      .from(schema.release)
      .innerJoin(
        schema.versionRelease,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.variableSetRelease,
        eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
      )
      .where(eq(schema.versionRelease.releaseTargetId, releaseTarget.id))
      .orderBy(desc(schema.release.createdAt))
      .limit(1)
      .then(takeFirstOrNull);

    if (existingRelease == null)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No release exists for this target",
      });

    await createReleaseJob(tx, existingRelease.release);

    return existingRelease;
  });

const handleDeployment = async (
  db: Tx,
  releaseTargets: schema.ReleaseTarget[],
  force: boolean,
) => {
  if (force) {
    const forceDeploymentPromises = releaseTargets.map((releaseTarget) =>
      createForceDeployment(db, releaseTarget),
    );
    await Promise.all(forceDeploymentPromises);
    return;
  }

  await Promise.all(
    releaseTargets.map((releaseTarget) =>
      eventDispatcher.dispatchEvaluateReleaseTarget(releaseTarget, {
        skipDuplicateCheck: true,
      }),
    ),
  );
};

const redeployProcedure = protectedProcedure
  .input(
    z
      .object({
        environmentId: z.string().uuid().optional(),
        deploymentId: z.string().uuid().optional(),
        resourceId: z.string().uuid().optional(),
        force: z.boolean().optional().default(false),
      })
      .refine(
        ({ environmentId, deploymentId, resourceId }) =>
          environmentId != null || deploymentId != null || resourceId != null,
      ),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) => {
      const { environmentId, deploymentId, resourceId } = input;
      const environmentAuthzPromise = environmentId
        ? canUser
            .perform(Permission.EnvironmentGet)
            .on({ type: "environment", id: environmentId })
        : true;

      const deploymentAuthzPromise = deploymentId
        ? canUser
            .perform(Permission.DeploymentGet)
            .on(
              { type: "deployment", id: deploymentId },
              { type: "environment", id: environmentId },
            )
        : true;

      const resourceAuthzPromise = resourceId
        ? canUser
            .perform(Permission.ResourceGet)
            .on({ type: "resource", id: resourceId })
        : true;

      return Promise.all([
        environmentAuthzPromise,
        deploymentAuthzPromise,
        resourceAuthzPromise,
      ]).then((results) => results.every(Boolean));
    },
  })
  .mutation(async ({ ctx: { db }, input }) => {
    const { environmentId, deploymentId, resourceId } = input;

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: and(
        environmentId != null
          ? eq(schema.releaseTarget.environmentId, environmentId)
          : undefined,
        deploymentId != null
          ? eq(schema.releaseTarget.deploymentId, deploymentId)
          : undefined,
        resourceId != null
          ? eq(schema.releaseTarget.resourceId, resourceId)
          : undefined,
      ),
    });

    if (releaseTargets.length === 0) return 0;
    await handleDeployment(db, releaseTargets, input.force);
    return releaseTargets.length;
  });

const redeployToEnvironmentProcedure = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
      releaseTargetIds: z.array(z.string().uuid()),
      force: z.boolean().optional().default(false),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.EnvironmentUpdate).on({
        type: "environment",
        id: input.environmentId,
      }),
  })
  .mutation(async ({ ctx: { db }, input }) => {
    const { releaseTargetIds, force } = input;
    if (releaseTargetIds.length === 0) return 0;

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: and(
        inArray(schema.releaseTarget.id, releaseTargetIds),
        eq(schema.releaseTarget.environmentId, input.environmentId),
      ),
    });

    if (releaseTargets.length === 0) return 0;
    await handleDeployment(db, releaseTargets, force);
    return releaseTargets.length;
  });

export const redeployRouter = createTRPCRouter({
  toEnvironment: redeployToEnvironmentProcedure,
  toReleaseTargets: redeployProcedure,
});
