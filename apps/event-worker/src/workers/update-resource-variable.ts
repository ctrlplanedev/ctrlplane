import _ from "lodash";

import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceChildren } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    const { data: variable } = job;
    const { resourceId, key } = variable;

    const dependentResources = await getResourceChildren(db, resourceId);

    const affectedReleaseTargets = await db
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
            dependentResources.map((dr) => dr.source.id),
          ),
        ),
      )
      .then((rows) => rows.map((row) => row.release_target));

    dispatchQueueJob().toEvaluate().releaseTargets(affectedReleaseTargets);
  },
);
