import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import type { ReleaseTarget } from "./utils";
import { protectedProcedure } from "../../trpc";
import { getReleaseTarget } from "./utils";

const getVersionRelease = async (
  releaseTarget: ReleaseTarget,
  versionId: string,
) => {
  const existingVersionRelease = await db
    .select()
    .from(schema.versionRelease)
    .where(
      and(
        eq(schema.versionRelease.releaseTargetId, releaseTarget.id),
        eq(schema.versionRelease.versionId, versionId),
      ),
    )
    .then(takeFirstOrNull);

  if (existingVersionRelease != null) return existingVersionRelease;

  const { workspaceId } = releaseTarget.resource;
  const vrm = new VersionReleaseManager(db, {
    ...releaseTarget,
    workspaceId,
  });
  const { release: versionRelease } = await vrm.upsertRelease(versionId);

  return versionRelease;
};

const getVariableSetRelease = async (releaseTarget: ReleaseTarget) => {
  const releaseTargetId = releaseTarget.id;
  const existingVariableSetRelease = await db
    .select()
    .from(schema.variableSetRelease)
    .where(eq(schema.variableSetRelease.releaseTargetId, releaseTargetId))
    .then(takeFirstOrNull);

  if (existingVariableSetRelease != null) return existingVariableSetRelease;

  const { workspaceId } = releaseTarget.resource;

  const varrm = new VariableReleaseManager(db, {
    ...releaseTarget,
    workspaceId,
  });

  const { chosenCandidate: variableValues } = await varrm.evaluate();

  const { release: variableRelease } =
    await varrm.upsertRelease(variableValues);

  return variableRelease;
};

const getRelease = async (
  versionReleaseId: string,
  variableReleaseId: string,
) => {
  const existingRelease = await db
    .select()
    .from(schema.release)
    .where(
      and(
        eq(schema.release.versionReleaseId, versionReleaseId),
        eq(schema.release.variableReleaseId, variableReleaseId),
      ),
    )
    .then(takeFirstOrNull);

  if (existingRelease != null) return existingRelease;

  return db
    .insert(schema.release)
    .values({ versionReleaseId, variableReleaseId })
    .returning()
    .then(takeFirst);
};

export const forceDeployVersion = protectedProcedure
  .input(
    z.object({
      releaseTargetId: z.string().uuid(),
      versionId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input.releaseTargetId,
      }),
  })
  .mutation(async ({ ctx, input }) => {
    const { releaseTargetId, versionId } = input;
    const releaseTarget = await getReleaseTarget(releaseTargetId);
    const [versionRelease, variableRelease] = await Promise.all([
      getVersionRelease(releaseTarget, versionId),
      getVariableSetRelease(releaseTarget),
    ]);
    const release = await getRelease(versionRelease.id, variableRelease.id);
    const releaseJob = await createReleaseJob(ctx.db, release);

    getQueue(Channel.DispatchJob).add(releaseJob.id, {
      jobId: releaseJob.id,
    });

    return releaseJob;
  });
