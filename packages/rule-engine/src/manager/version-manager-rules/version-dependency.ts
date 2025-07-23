import { and, eq, selector, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { VersionDependencyRule } from "../../rules/version-dependency-rule.js";

const getVersionDependencies = async (versionId: string) =>
  db
    .select()
    .from(schema.versionDependency)
    .where(eq(schema.versionDependency.versionId, versionId));

const getResourceFromReleaseTarget = async (releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .then(takeFirst)
    .then(({ resource }) => resource);

const getIsVersionDependencySatisfied = async (releaseTargetId: string) => {
  const resource = await getResourceFromReleaseTarget(releaseTargetId);

  return (dependency: schema.VersionDependency) =>
    db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.versionRelease,
        eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.deploymentVersion,
        eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
      )
      .innerJoin(
        schema.release,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseJob,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
      .where(
        and(
          eq(schema.releaseTarget.resourceId, resource.id),
          eq(schema.releaseTarget.deploymentId, dependency.deploymentId),
          selector()
            .query()
            .deploymentVersions()
            .where(dependency.versionSelector)
            .sql(),
          eq(schema.job.status, JobStatus.Successful),
        ),
      )
      .then(takeFirstOrNull)
      .then((result) => result != null);
};

export const getVersionDependencyRule = (releaseTargetId: string) =>
  getIsVersionDependencySatisfied(releaseTargetId).then(
    (isVersionDependencySatisfied) =>
      new VersionDependencyRule({
        getVersionDependencies,
        isVersionDependencySatisfied,
      }),
  );
