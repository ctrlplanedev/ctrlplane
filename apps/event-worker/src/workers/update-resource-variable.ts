import _ from "lodash";

import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceChildren } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

const getResourceReleaseTargets = async (resourceId: string) =>
  db.query.releaseTarget.findMany({
    where: eq(schema.releaseTarget.resourceId, resourceId),
  });

const getResourceChildrenReleaseTargets = async (
  resourceId: string,
  key: string,
) => {
  const dependentResources = await getResourceChildren(db, resourceId);

  return db
    .selectDistinctOn([schema.releaseTarget.id])
    .from(schema.releaseTarget)
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.deploymentVariable,
      eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        eq(schema.deploymentVariable.key, key),
        inArray(
          schema.releaseTarget.resourceId,
          dependentResources.map((dr) => dr.target.id),
        ),
      ),
    )
    .then((rows) => rows.map((row) => row.release_target));
};

export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    const { data: variable } = job;
    const { resourceId, key } = variable;

    const resourceReleaseTargets = await getResourceReleaseTargets(resourceId);

    const childrenReleaseTargets = await getResourceChildrenReleaseTargets(
      resourceId,
      key,
    );

    const affectedReleaseTargets = [
      ...resourceReleaseTargets,
      ...childrenReleaseTargets,
    ];

    dispatchQueueJob().toEvaluate().releaseTargets(affectedReleaseTargets);
  },
);
