import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import {
  enqueueDesiredRelease,
  enqueueJobDispatch,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

type ReleaseTarget = {
  deploymentId: string;
  environmentId: string;
  resourceId: string;
};

const getLatestJobForTarget = (db: Tx, releaseTarget: ReleaseTarget) =>
  db
    .select()
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.job.id, schema.releaseJob.jobId))
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .where(
      and(
        eq(schema.release.deploymentId, releaseTarget.deploymentId),
        eq(schema.release.environmentId, releaseTarget.environmentId),
        eq(schema.release.resourceId, releaseTarget.resourceId),
      ),
    )
    .orderBy(desc(schema.job.createdAt))
    .limit(1)
    .then(takeFirstOrNull)
    .then((result) => result?.job ?? null);

const getJobMetadata = (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.jobMetadata)
    .where(eq(schema.jobMetadata.jobId, jobId))
    .then((rows) =>
      Object.fromEntries(rows.map((row) => [row.key, row.value])),
    );

const getJobReleaseId = (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.releaseJob)
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirstOrNull)
    .then((result) => result?.releaseId ?? null);

const redeployReleaseTarget = async (
  db: Tx,
  workspaceId: string,
  releaseTarget: ReleaseTarget,
) => {
  const job = await getLatestJobForTarget(db, releaseTarget);
  if (job == null)
    return enqueueDesiredRelease(db, {
      workspaceId,
      deploymentId: releaseTarget.deploymentId,
      environmentId: releaseTarget.environmentId,
      resourceId: releaseTarget.resourceId,
    });

  const releaseId = await getJobReleaseId(db, job.id);
  if (releaseId == null)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Job release not found",
    });

  const metadata = await getJobMetadata(db, job.id);

  const newJob = {
    id: uuidv4(),
    status: "pending" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    jobAgentId: job.jobAgentId,
    jobAgentConfig: job.jobAgentConfig,
    dispatchContext: job.dispatchContext,
    reason: "redeploy" as const,
    metadata,
  };

  await db.transaction(async (tx) => {
    await tx.insert(schema.job).values(newJob);
    await tx.insert(schema.releaseJob).values({
      releaseId,
      jobId: newJob.id,
    });
    await enqueueJobDispatch(tx, {
      workspaceId,
      jobId: newJob.id,
    });
  });
};

export const redeployRouter = router({
  releaseTarget: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        releaseTarget: z.object({
          deploymentId: z.uuid(),
          environmentId: z.uuid(),
          resourceId: z.uuid(),
        }),
      }),
    )
    .mutation(({ input: { workspaceId, releaseTarget }, ctx }) =>
      redeployReleaseTarget(ctx.db, workspaceId, releaseTarget),
    ),

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        releaseTargets: z.array(
          z.object({
            deploymentId: z.string(),
            environmentId: z.string(),
            resourceId: z.string(),
          }),
        ),
      }),
    )
    .mutation(({ input: { workspaceId, releaseTargets }, ctx }) =>
      releaseTargets.map((releaseTarget) =>
        redeployReleaseTarget(ctx.db, workspaceId, releaseTarget),
      ),
    ),
});
