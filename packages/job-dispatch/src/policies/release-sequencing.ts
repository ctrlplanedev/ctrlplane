import _ from "lodash";

import { and, asc, desc, eq, inArray, notExists, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { activeStatus } from "@ctrlplane/validators/jobs";

import type { ReleaseIdPolicyChecker } from "./utils.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns job triggers that are not blocked by an active release
 */
export const isPassingNoActiveJobsPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];

  const unblockedTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        inArray(
          schema.releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id),
        ),
        notExists(
          db.execute(sql<schema.Job[]>`
            select 1 from ${schema.job}
            inner join ${schema.releaseJobTrigger} as rjt2 on ${schema.job.id} = rjt2.job_id
            inner join ${schema.release} as release2 on rjt2.release_id = release2.id
            where rjt2.environment_id = ${schema.releaseJobTrigger.environmentId}
            and release2.deployment_id = ${schema.deployment.id}
            and release2.id != ${schema.release.id}
            and ${inArray(schema.job.status, activeStatus)}
          `),
        ),
      ),
    )
    .orderBy(
      asc(schema.deployment.id),
      desc(schema.release.createdAt),
      desc(schema.release.version),
    );

  // edge case - if multiple releases are created at the same time, only take latest, then highest lexicographical version
  return _.chain(unblockedTriggers)
    .groupBy((rjt) => [
      rjt.deployment.id,
      rjt.release_job_trigger.environmentId,
    ])
    .flatMap((rjt) => {
      const maxRelease = _.maxBy(rjt, (rjt) => [
        rjt.release.createdAt,
        rjt.release.version,
      ]);
      return rjt.filter((rjt) => rjt.release.id === maxRelease?.release.id);
    })
    .map((rjt) => rjt.release_job_trigger)
    .value();
};
