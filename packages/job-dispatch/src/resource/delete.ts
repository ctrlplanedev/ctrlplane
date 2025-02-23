import type { Tx } from "@ctrlplane/db";
import type { Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, inArray, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { getEventsForResourceDeleted, handleEvent } from "../events/index.js";
import { updateJob } from "../job-update.js";

const deleteObjectsAssociatedWithResource = (tx: Tx, resource: Resource) =>
  tx
    .delete(SCHEMA.resourceRelationship)
    .where(
      or(
        eq(SCHEMA.resourceRelationship.fromIdentifier, resource.identifier),
        eq(SCHEMA.resourceRelationship.toIdentifier, resource.identifier),
      ),
    );

const cancelJobsForDeletedResources = (tx: Tx, resources: Resource[]) =>
  tx
    .select()
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .innerJoin(
      SCHEMA.resource,
      eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
    )
    .where(
      and(
        inArray(
          SCHEMA.resource.id,
          resources.map((r) => r.id),
        ),
        inArray(SCHEMA.job.status, [JobStatus.Pending, JobStatus.InProgress]),
      ),
    )
    .then((rjt) => rjt.map((rjt) => rjt.job.id))
    .then((jobIds) =>
      Promise.all(
        jobIds.map((jobId) =>
          updateJob(tx, jobId, { status: JobStatus.Cancelled }),
        ),
      ),
    );

/**
 * Delete resources from the database.
 *
 * @param tx - The transaction to use.
 * @param resourceIds - The ids of the resources to delete.
 */
export const deleteResources = async (tx: Tx, resources: Resource[]) => {
  const eventsPromises = Promise.all(
    resources.map(getEventsForResourceDeleted),
  );
  const events = await eventsPromises.then((res) => res.flat());
  await Promise.all(events.map(handleEvent));
  const resourceIds = resources.map((r) => r.id);
  const deleteAssociatedObjects = Promise.all(
    resources.map((r) => deleteObjectsAssociatedWithResource(tx, r)),
  );
  const cancelJobs = cancelJobsForDeletedResources(tx, resources);
  await Promise.all([
    deleteAssociatedObjects,
    cancelJobs,
    tx
      .update(SCHEMA.resource)
      .set({ deletedAt: new Date() })
      .where(inArray(SCHEMA.resource.id, resourceIds)),
  ]);
};
