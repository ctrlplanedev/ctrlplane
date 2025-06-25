import type { Tx } from "@ctrlplane/db";

import { count, eq, takeFirst } from "@ctrlplane/db";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";

export const getNumRetryAttempts = async (db: Tx, jobId: string) => {
  const { release } = await db
    .select()
    .from(schema.release)
    .innerJoin(
      schema.releaseJob,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirst);

  return db
    .select({ count: count() })
    .from(schema.releaseJob)
    .where(eq(schema.releaseJob.releaseId, release.id))
    .then(takeFirst)
    .then((row) => row.count);
};

const getReleaseInfo = async (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.release)
    .innerJoin(
      schema.releaseJob,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.variableSetRelease,
      eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirst);

export const retryJob = async (db: Tx, jobId: string) => {
  const { release, version_release, variable_set_release } =
    await getReleaseInfo(db, jobId);

  const releaseId = release.id;
  const versionReleaseId = version_release.id;
  const variableReleaseId = variable_set_release.id;

  const newReleaseJob = await db.transaction((tx) =>
    createReleaseJob(tx, {
      id: releaseId,
      versionReleaseId,
      variableReleaseId,
    }),
  );

  await dispatchQueueJob().toDispatch().ctrlplaneJob(newReleaseJob.id);
};
