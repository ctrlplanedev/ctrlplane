import { isPresent } from "ts-is-present";

import {
  and,
  eq,
  inArray,
  selector,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";

import { getReleaseTarget } from "./utils.js";

const getVersion = (versionId: string) =>
  db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.id, versionId))
    .then(takeFirst);

const getDependencyVersionMatch = (
  dependency: schema.VersionDependency,
  versionId: string,
) =>
  db
    .select()
    .from(schema.deploymentVersion)
    .where(
      and(
        eq(schema.deploymentVersion.id, versionId),
        selector()
          .query()
          .deploymentVersions()
          .where(dependency.versionSelector)
          .sql(),
      ),
    )
    .then(takeFirstOrNull);

const getNewlySatisfiedDependencies = async (
  version: schema.DeploymentVersion,
) => {
  const { deploymentId } = version;
  const dependenciesOfThisDeployment = await db
    .select()
    .from(schema.versionDependency)
    .where(eq(schema.versionDependency.deploymentId, deploymentId));

  return Promise.all(
    dependenciesOfThisDeployment.map(async (dependency) => {
      const versionMatch = await getDependencyVersionMatch(
        dependency,
        version.id,
      );

      return versionMatch != null ? dependency : null;
    }),
  ).then((deps) => deps.filter(isPresent));
};

const getReleaseTargetsToEvaluate = async (
  resourceId: string,
  newlySatisfiedDependencies: schema.VersionDependency[],
) =>
  db
    .selectDistinctOn([schema.releaseTarget.id])
    .from(schema.deploymentVersion)
    .innerJoin(
      schema.deployment,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        inArray(
          schema.deploymentVersion.id,
          newlySatisfiedDependencies.map((d) => d.versionId),
        ),
        eq(schema.releaseTarget.resourceId, resourceId),
      ),
    )
    .then((rows) => rows.map((row) => row.release_target));

export const triggerDependentTargets = async (job: schema.Job) => {
  const releaseTargetResult = await getReleaseTarget(db, job.id);
  if (releaseTargetResult == null) return;
  const { resourceId } = releaseTargetResult.release_target;
  const { versionId } = releaseTargetResult.version_release;

  const version = await getVersion(versionId);
  const newlySatisfiedDependencies =
    await getNewlySatisfiedDependencies(version);
  const releaseTargetsToEvaluate = await getReleaseTargetsToEvaluate(
    resourceId,
    newlySatisfiedDependencies,
  );

  await dispatchQueueJob()
    .toEvaluate()
    .releaseTargets(releaseTargetsToEvaluate);
};
