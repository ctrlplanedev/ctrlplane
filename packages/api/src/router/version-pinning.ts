import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, isNotNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const updateReleaseTargets = async (
  db: Tx,
  input: {
    environmentId: string;
    versionId: string | null;
  },
) => {
  const releaseTargets = await db
    .update(schema.releaseTarget)
    .set({ desiredVersionId: input.versionId })
    .where(eq(schema.releaseTarget.environmentId, input.environmentId))
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
  .mutation(({ ctx, input }) => updateReleaseTargets(ctx.db, input));

const unpinVersion = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: async ({ canUser, input }) =>
      canUser.perform(Permission.EnvironmentUpdate).on({
        type: "environment",
        id: input.environmentId,
      }),
  })
  .mutation(({ ctx, input }) =>
    updateReleaseTargets(ctx.db, { ...input, versionId: null }),
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
        .on({
          type: "deployment",
          id: input.deploymentId,
        });

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
