import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";

import { env } from "../config.js";
import { ReleaseTargetMutex } from "../releases/mutex.js";

const log = logger.child({ worker: "policy-evaluate" });

const createRelease = async (
  tx: Tx,
  versionReleaseId: string,
  variableReleaseId: string,
) => {
  // Get version release and related data
  const versionRelease = await tx.query.versionRelease.findFirst({
    where: eq(schema.versionRelease.id, versionReleaseId),
    with: {
      version: { with: { deployment: { with: { jobAgent: true } } } },
    },
  });
  if (!versionRelease) throw new Error("Failed to get release");

  // Extract job agent info
  const { jobAgent, jobAgentConfig: deploymentJobAgentConfig } =
    versionRelease.version.deployment;
  if (!jobAgent) throw new Error("Deployment has no Job Agent");

  const jobAgentConfig = _.merge(jobAgent.config, deploymentJobAgentConfig);

  // Get variable release data
  const variableRelease = await tx.query.variableRelease.findFirst({
    where: eq(schema.variableRelease.id, variableReleaseId),
    with: { values: true },
  });
  if (!variableRelease) throw new Error("Failed to get variable release");

  // Create job
  const job = await tx
    .insert(schema.job)
    .values({
      jobAgentId: jobAgent.id,
      jobAgentConfig,
      status: "pending",
      reason: "policy_passing",
    })
    .returning()
    .then(takeFirst);

  // Add job variables if any exist
  if (variableRelease.values.length > 0) {
    await tx.insert(schema.jobVariable).values(
      variableRelease.values.map((v) => ({
        jobId: job.id,
        key: v.key,
        sensitive: v.sensitive,
        value: v.value,
      })),
    );
  }

  // Create release record
  await tx.insert(schema.release).values({
    jobId: job.id,
    versionReleaseId,
    variableReleaseId,
  });

  return job;
};

export const evaluateReleaseTarget = createWorker(
  Channel.EvaluateReleaseTarget,
  async (job) => {
    const mutex = await ReleaseTargetMutex.lock(job.data);

    try {
      // Get release target
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
      if (!releaseTarget) throw new Error("Failed to get release target");

      // Handle version release
      const vrm = new VersionReleaseManager(db, {
        ...releaseTarget,
        workspaceId: releaseTarget.resource.workspaceId,
      });

      const { chosenCandidate } = await vrm.evaluate();
      if (!chosenCandidate) throw new Error("Failed to get chosen release");

      const { release: versionRelease } = await vrm.upsertRelease(
        chosenCandidate.id,
      );

      // Handle variable release
      const varrm = new VariableReleaseManager(db, {
        ...releaseTarget,
        workspaceId: releaseTarget.resource.workspaceId,
      });

      const existingVariableRelease = await varrm.findLatestRelease();
      const variableReleaseId =
        existingVariableRelease?.id ??
        (await varrm.upsertRelease([]).then((r) => r.release.id));

      if (!variableReleaseId) throw new Error("Failed to get variable release");

      // Create and dispatch job in development
      if (env.NODE_ENV === "development") {
        const job = await db.transaction((tx) =>
          createRelease(tx, versionRelease.id, variableReleaseId),
        );
        getQueue(Channel.DispatchJob).add(job.id, { jobId: job.id });
      }
    } catch (e) {
      log.error("Failed to evaluate release target", {
        error: e,
        jobId: job.id,
      });
    } finally {
      await mutex.unlock();
    }
  },
);
