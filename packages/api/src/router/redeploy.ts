import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../trpc";

const createForceDeployment = async (
  db: Tx,
  releaseTarget: typeof schema.releaseTarget.$inferSelect,
) => {
  return db.transaction(async (tx) => {
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

    const job = await createReleaseJob(tx, existingRelease.release);
    getQueue(Channel.DispatchJob).add(job.id, { jobId: job.id });

    return existingRelease;
  });
};

const handleDeployment = async (
  ctx: any,
  releaseTargets: any[],
  force: boolean,
) => {
  if (force) {
    for (const releaseTarget of releaseTargets) {
      await createForceDeployment(ctx, releaseTarget);
    }
    return;
  }

  for (const releaseTarget of releaseTargets) {
    getQueue(Channel.EvaluateReleaseTarget).add(releaseTarget.id, {
      ...releaseTarget,
      skipDuplicateCheck: true,
    });
  }
};

export const redeployProcedure = protectedProcedure
  .input(
    z.union([
      z.object({
        environmentId: z.string().uuid(),
        force: z.boolean().optional().default(false),
      }),
      z.object({
        deploymentId: z.string().uuid(),
        force: z.boolean().optional().default(false),
      }),
      z.object({
        resourceId: z.string().uuid(),
        force: z.boolean().optional().default(false),
      }),
      z.object({
        environmentId: z.string().uuid(),
        deploymentId: z.string().uuid(),
        force: z.boolean().optional().default(false),
      }),
    ]),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) => {
      if (input.environmentId && input.deploymentId) {
        return canUser
          .perform(Permission.DeploymentGet)
          .on(
            { type: "deployment", id: input.deploymentId },
            { type: "environment", id: input.environmentId },
          );
      }
      if (input.environmentId) {
        return canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input.environmentId });
      }
      if (input.resourceId) {
        return canUser
          .perform(Permission.ResourceGet)
          .on({ type: "resource", id: input.resourceId });
      }
      if (input.deploymentId) {
        return canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId });
      }
      return false;
    },
  })
  .mutation(async ({ ctx, input }) => {
    const releaseTargets = await ctx.db.query.releaseTarget.findMany({
      where: and(
        ...("deploymentId" in input
          ? [eq(schema.releaseTarget.deploymentId, input.deploymentId)]
          : []),
        ...("environmentId" in input
          ? [eq(schema.releaseTarget.environmentId, input.environmentId)]
          : []),
        ...("resourceId" in input
          ? [eq(schema.releaseTarget.resourceId, input.resourceId)]
          : []),
      ),
    });

    if (releaseTargets.length === 0) return 0;
    await handleDeployment(ctx, releaseTargets, input.force);
    return releaseTargets.length;
  });
