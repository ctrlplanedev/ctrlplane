import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, asc, count, desc, eq, inArray } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const getVersionDistro = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
  resourceIds: string[],
) => {
  const latestVersionByResourceSubquery = db
    .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId], {
      tag: SCHEMA.deploymentVersion.tag,
      tagResourceId: SCHEMA.releaseJobTrigger.resourceId,
      versionCreatedAt: SCHEMA.deploymentVersion.createdAt,
    })
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .innerJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .where(
      and(
        eq(SCHEMA.job.status, JobStatus.Successful),
        eq(SCHEMA.releaseJobTrigger.environmentId, environment.id),
        eq(SCHEMA.deploymentVersion.deploymentId, deployment.id),
        inArray(SCHEMA.releaseJobTrigger.resourceId, resourceIds),
      ),
    )
    .orderBy(SCHEMA.releaseJobTrigger.resourceId, desc(SCHEMA.job.createdAt))
    .as("latestVersionByResource");

  const versionCounts = await db
    .select({ tag: latestVersionByResourceSubquery.tag, count: count() })
    .from(SCHEMA.resource)
    .innerJoin(
      latestVersionByResourceSubquery,
      eq(SCHEMA.resource.id, latestVersionByResourceSubquery.tagResourceId),
    )
    .where(inArray(SCHEMA.resource.id, resourceIds))
    .groupBy(
      latestVersionByResourceSubquery.tag,
      latestVersionByResourceSubquery.versionCreatedAt,
    )
    .orderBy(asc(latestVersionByResourceSubquery.versionCreatedAt));

  const total = _.sumBy(versionCounts, (v) => v.count);

  return Object.fromEntries(
    versionCounts.map((v) => [
      v.tag,
      { count: v.count, percentage: v.count / total },
    ]),
  );
};
