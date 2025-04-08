import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, or, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  getEventsForResourceDeleted,
  handleEvent,
  updateJob,
} from "@ctrlplane/job-dispatch";
import { JobStatus } from "@ctrlplane/validators/jobs";

const deleteObjectsAssociatedWithResource = (
  db: Tx,
  resource: SCHEMA.Resource,
) =>
  db
    .delete(SCHEMA.resourceRelationship)
    .where(
      or(
        eq(SCHEMA.resourceRelationship.fromIdentifier, resource.identifier),
        eq(SCHEMA.resourceRelationship.toIdentifier, resource.identifier),
      ),
    );

const cancelJobs = async (db: Tx, resource: SCHEMA.Resource) => {
  const jobs = await db
    .select()
    .from(SCHEMA.job)
    .innerJoin(SCHEMA.releaseJob, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
    )
    .innerJoin(
      SCHEMA.releaseTarget,
      eq(SCHEMA.release.releaseTargetId, SCHEMA.releaseTarget.id),
    )
    .where(
      and(
        eq(SCHEMA.releaseTarget.resourceId, resource.id),
        inArray(SCHEMA.job.status, [JobStatus.Pending, JobStatus.InProgress]),
      ),
    );

  await Promise.all(
    jobs.map((job) =>
      updateJob(db, job.job.id, { status: JobStatus.Cancelled }),
    ),
  );
};

export const deleteResource = async (db: Tx, resourceId: string) => {
  const where = eq(SCHEMA.resource.id, resourceId);
  const resource = await db.query.resource.findFirst({ where });
  if (resource == null) throw new Error(`Resource not found: ${resourceId}`);

  const events = await getEventsForResourceDeleted(resource);
  const eventPromises = events.map(handleEvent);
  const deleteObjectsPromise = deleteObjectsAssociatedWithResource(
    db,
    resource,
  );
  const cancelJobsPromise = cancelJobs(db, resource);

  await Promise.all([
    ...eventPromises,
    deleteObjectsPromise,
    cancelJobsPromise,
  ]);

  return db.delete(SCHEMA.resource).where(where).returning().then(takeFirst);
};
