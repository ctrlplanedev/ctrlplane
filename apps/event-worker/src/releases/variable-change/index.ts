import type { SQL } from "@ctrlplane/db";
import type { ReleaseRepository } from "@ctrlplane/rule-engine";
import type { ReleaseVariableChangeEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { and, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  Channel,
  releaseDeploymentVariableChangeEvent,
  releaseResourceVariableChangeEvent,
  releaseSystemVariableChangeEvent,
} from "@ctrlplane/validators/events";

import { redis } from "../../redis.js";
import { createAndEvaluateRelease } from "../create-release.js";

const getResourceReleases = async (where: SQL) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(and(where, isNull(schema.resource.deletedAt)))
    .then((rows) =>
      rows.map((r) => ({ ...r.release_target, resource: r.resource })),
    );

const handleDeploymentVariableChange = async (deploymentVariableId: string) => {
  const variable = await db
    .select()
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.id, deploymentVariableId))
    .then(takeFirstOrNull);

  if (variable == null) throw new Error("Deployment variable not found");

  return getResourceReleases(
    eq(schema.releaseTarget.deploymentId, variable.deploymentId),
  );
};

// const handleSystemVariableChange = (_: string) => {
//   const variableSet = await db.query.variableSet.findFirst({
//     where: eq(schema.variableSet.id, systemVariableSetId),
//     with: { system: true },
//   });
//   if (variableSet == null) throw new Error("System variable set not found");

//   const { deployment } = variableSet;
//   return getDeploymentResources(db, deployment);
// };

const handleResourceVariableChange = async (resourceVariableId: string) => {
  return getResourceReleases(
    eq(schema.releaseTarget.resourceId, resourceVariableId),
  );
};

export const createReleaseVariableChangeWorker = () =>
  new Worker<ReleaseVariableChangeEvent>(
    Channel.ReleaseVariableChange,
    async (job) => {
      const repos: ReleaseRepository[] = [];

      const deploymentResult = releaseDeploymentVariableChangeEvent.safeParse(
        job.data,
      );
      if (deploymentResult.success)
        repos.push(
          ...(await handleDeploymentVariableChange(
            deploymentResult.data.deploymentVariableId,
          )),
        );

      const systemResult = releaseSystemVariableChangeEvent.safeParse(job.data);
      if (systemResult.success) throw new Error("Not supported yet");

      const resourceResult = releaseResourceVariableChangeEvent.safeParse(
        job.data,
      );
      if (resourceResult.success)
        repos.push(
          ...(await handleResourceVariableChange(
            resourceResult.data.resourceVariableId,
          )),
        );

      job.log(`Creating ${repos.length} releases`);
      await Promise.allSettled(
        repos.map((repo) => createAndEvaluateRelease(repo)),
      );
      job.log(`Created ${repos.length} releases`);
    },
    {
      connection: redis,
      removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
      removeOnFail: { age: 12 * 60 * 60, count: 5000 },
      concurrency: 100,
    },
  );
