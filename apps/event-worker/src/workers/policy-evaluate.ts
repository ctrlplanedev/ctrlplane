import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import {
  DatabaseReleaseRepository,
  evaluateRepository,
} from "@ctrlplane/rule-engine";

import { env } from "../config.js";
import { ReleaseTargetMutex } from "../releases/mutex.js";

const createJobForRelease = async (tx: Tx, chosenReleaseId: string) => {
  const release = await tx.query.release.findFirst({
    where: eq(schema.release.id, chosenReleaseId),
    with: {
      variables: true,
      version: { with: { deployment: { with: { jobAgent: true } } } },
    },
  });

  if (release == null) throw new Error("Failed to get release");

  const { version } = release;
  const { deployment } = version;
  const { jobAgent, jobAgentConfig: deploymentJobAgentConfig } = deployment;
  if (jobAgent == null) throw new Error("Deployment has no Job Agent");

  const jobAgentId = jobAgent.id;
  const jobAgentConfig = _.merge(jobAgent.config, deploymentJobAgentConfig);

  const job = await tx
    .insert(schema.job)
    .values({
      jobAgentId,
      jobAgentConfig,
      status: "pending",
      reason: "policy_passing",
    })
    .returning()
    .then(takeFirst);

  await tx.insert(schema.jobVariable).values(
    release.variables.map((v) => ({
      jobId: job.id,
      key: v.key,
      sensitive: v.sensitive,
      value: v.value,
    })),
  );

  await tx.insert(schema.releaseJob).values({
    jobId: job.id,
    releaseId: chosenReleaseId,
  });

  return job;
};

export const policyEvaluate = createWorker(
  Channel.EvaluateReleaseTarget,
  async (job) => {
    const mutex = await ReleaseTargetMutex.lock(job.data);
    try {
      const releaseTarget = await db.query.releaseTarget.findFirst({
        where: and(
          eq(schema.releaseTarget.resourceId, job.data.resourceId),
          eq(schema.releaseTarget.environmentId, job.data.environmentId),
          eq(schema.releaseTarget.deploymentId, job.data.deploymentId),
        ),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
      });
      if (releaseTarget == null)
        throw new Error("Failed to get release target");

      const releaseRepository = await DatabaseReleaseRepository.create({
        ...releaseTarget,
        workspaceId: releaseTarget.resource.workspaceId,
      });

      const { chosenRelease } = await evaluateRepository(releaseRepository);
      if (chosenRelease == null)
        throw new Error("Failed to get chosen release");

      if (env.NODE_ENV === "development") {
        // In development dispatch the job immediately
        const job = await db.transaction((tx) =>
          createJobForRelease(tx, chosenRelease.id),
        );
        getQueue(Channel.DispatchJob).add(job.id, { jobId: job.id });
      }
    } finally {
      await mutex.unlock();
    }
  },
);
