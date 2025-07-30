import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, isNotNull, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const pinReleaseTargetsToVersion = async (
  db: Tx,
  environmentId: string,
  deploymentId: string,
  version: schema.DeploymentVersion | null,
) => {
  const versionId = version?.id ?? null;
  const releaseTargets = await db
    .update(schema.releaseTarget)
    .set({ desiredVersionId: versionId })
    .where(
      and(
        eq(schema.releaseTarget.environmentId, environmentId),
        eq(schema.releaseTarget.deploymentId, deploymentId),
      ),
    )
    .returning();

  await dispatchQueueJob().toEvaluate().releaseTargets(releaseTargets);

  return releaseTargets;
};

const pinVersion = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
      versionId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: async ({ canUser, input }) =>
      canUser.perform(Permission.EnvironmentUpdate).on({
        type: "environment",
        id: input.environmentId,
      }),
  })
  .mutation(async ({ ctx, input: { environmentId, versionId } }) => {
    const version = await ctx.db
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, versionId))
      .then(takeFirst);

    const { deploymentId } = version;

    return pinReleaseTargetsToVersion(
      ctx.db,
      environmentId,
      deploymentId,
      version,
    );
  });

const unpinVersion = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
      deploymentId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: async ({ canUser, input }) =>
      canUser.perform(Permission.EnvironmentUpdate).on({
        type: "environment",
        id: input.environmentId,
      }),
  })
  .mutation(({ ctx, input: { environmentId, deploymentId } }) =>
    pinReleaseTargetsToVersion(ctx.db, environmentId, deploymentId, null),
  );

const pinnedVersions = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
      deploymentId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: async ({ canUser, input }) => {
      const envAuthzPromise = canUser.perform(Permission.EnvironmentGet).on({
        type: "environment",
        id: input.environmentId,
      });

      const deploymentAuthzPromise = canUser
        .perform(Permission.DeploymentGet)
        .on({ type: "deployment", id: input.deploymentId });

      const [envAuthzResult, deploymentAuthzResult] = await Promise.all([
        envAuthzPromise,
        deploymentAuthzPromise,
      ]);

      return envAuthzResult && deploymentAuthzResult;
    },
  })
  .query(({ ctx, input }) =>
    ctx.db
      .selectDistinct({ versionId: schema.releaseTarget.desiredVersionId })
      .from(schema.releaseTarget)
      .where(
        and(
          eq(schema.releaseTarget.environmentId, input.environmentId),
          eq(schema.releaseTarget.deploymentId, input.deploymentId),
          isNotNull(schema.releaseTarget.desiredVersionId),
        ),
      )
      .then((rows) =>
        rows
          .filter((row) => isPresent(row.versionId))
          .map((row) => row.versionId!),
      ),
  );

export const versionPinningRouter = createTRPCRouter({
  pinnedVersions,
  pinVersion,
  unpinVersion,
});
