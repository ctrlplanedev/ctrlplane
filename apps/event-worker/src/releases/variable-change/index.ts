import type { ReleaseRepository } from "@ctrlplane/rule-engine";
import type { ReleaseVariableChangeEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
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

const handleDeploymentVariableChange = async (deploymentVariableId: string) => {
  const variable = await db
    .select()
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.id, deploymentVariableId))
    .then(takeFirstOrNull);

  if (variable == null) throw new Error("Deployment variable not found");

  return db.query.resourceRelease.findMany({
    where: eq(schema.resourceRelease.deploymentId, variable.deploymentId),
    with: { resource: { where: isNull(schema.resource.deletedAt) } },
  });
};

const handleSystemVariableChange = async (systemVariableSetId: string) => {
  const { deployment } =
    (await db
      .select()
      .from(schema.variableSet)
      .innerJoin(
        schema.deployment,
        eq(schema.variableSet.systemId, schema.deployment.systemId),
      )
      .where(eq(schema.variableSet.id, systemVariableSetId))
      .then(takeFirstOrNull)) ?? {};

  if (deployment == null) throw new Error("System variable set not found");

  return db.query.resourceRelease.findMany({
    where: eq(schema.resourceRelease.deploymentId, deployment.id),
    with: { resource: { where: isNull(schema.resource.deletedAt) } },
  });
};

const handleResourceVariableChange = async (resourceVariableId: string) => {
  return db.query.resourceRelease.findMany({
    where: eq(schema.resourceRelease.resourceId, resourceVariableId),
    with: { resource: { where: isNull(schema.resource.deletedAt) } },
  });
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
      if (systemResult.success)
        repos.push(
          ...(await handleSystemVariableChange(
            systemResult.data.systemVariableSetId,
          )),
        );

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
