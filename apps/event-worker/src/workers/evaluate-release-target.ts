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

const log = logger.child({ worker: "evaluate-release-target" });

/**
 * Creates a new release job with the given version and variable releases
 * @param tx - Database transaction
 * @param release - Release object containing version and variable release IDs
 * @returns Created job
 * @throws Error if version release, job agent, or variable release not found
 */
const createRelease = async (
  tx: Tx,
  release: { id: string; versionReleaseId: string; variableReleaseId: string },
) => {
  // Get version release and related data
  const versionRelease = await tx.query.versionRelease.findFirst({
    where: eq(schema.versionRelease.id, release.versionReleaseId),
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
  const variableRelease = await tx.query.variableSetRelease.findFirst({
    where: eq(schema.variableSetRelease.id, release.variableReleaseId),
    with: { values: { with: { variableValueSnapshot: true } } },
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
        key: v.variableValueSnapshot.key,
        sensitive: v.variableValueSnapshot.sensitive,
        value: v.variableValueSnapshot.value,
      })),
    );
  }

  // Create release record
  await tx.insert(schema.releaseJob).values({
    releaseId: release.id,
    jobId: job.id,
  });

  return job;
};

/**
 * Handles version release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created version release
 * @throws Error if no candidate is chosen
 */
const handleVersionRelease = async (releaseTarget: any) => {
  const startTime = performance.now();

  const vrm = new VersionReleaseManager(db, {
    ...releaseTarget,
    workspaceId: releaseTarget.resource.workspaceId,
  });

  const { chosenCandidate } = await vrm.evaluate();
  if (!chosenCandidate) return null;

  const { release: versionRelease } = await vrm.upsertRelease(
    chosenCandidate.id,
  );

  const endTime = performance.now();
  log.info(
    `version release evaluation took ${((endTime - startTime) / 1000).toFixed(2)}s`,
  );

  return versionRelease;
};

/**
 * Handles variable release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created variable release
 */
const handleVariableRelease = async (releaseTarget: any) => {
  const varrm = new VariableReleaseManager(db, {
    ...releaseTarget,
    workspaceId: releaseTarget.resource.workspaceId,
  });

  const { chosenCandidate: variableValues } = await varrm.evaluate();
  const { release: variableRelease } =
    await varrm.upsertRelease(variableValues);

  return variableRelease;
};

/**
 * Worker that evaluates a release target and creates necessary releases and jobs
 * Only runs in development environment
 * Uses mutex to prevent concurrent evaluations of the same target
 */
export const evaluateReleaseTarget = createWorker(
  Channel.EvaluateReleaseTarget,
  async (job) => {
    log.info(`Evaluating release target ${job.data.resourceId}`, {
      jobId: job.id,
    });
    const mutex = await ReleaseTargetMutex.lock(job.data);
    log.info(`Acquired mutex lock for release target ${job.data.resourceId}`, {
      jobId: job.id,
    });

    try {
      // Get release target
      const releaseTarget = await db.query.releaseTarget.findFirst({
        where: and(
          eq(schema.releaseTarget.resourceId, job.data.resourceId),
          eq(schema.releaseTarget.environmentId, job.data.environmentId),
          eq(schema.releaseTarget.deploymentId, job.data.deploymentId),
        ),
        with: { resource: true, environment: true, deployment: true },
      });
      if (!releaseTarget) throw new Error("Failed to get release target");

      const versionRelease = await handleVersionRelease(releaseTarget);
      const variableRelease = await handleVariableRelease(releaseTarget);

      if (versionRelease == null) {
        log.info("No valid version release found.", { releaseTarget });
        return;
      }

      const release = await db
        .insert(schema.release)
        .values({
          versionReleaseId: versionRelease.id,
          variableReleaseId: variableRelease.id,
        })
        .onConflictDoNothing()
        .returning()
        .then(takeFirst);

      if (env.NODE_ENV === "development") {
        const job = await db.transaction((tx) => createRelease(tx, release));
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
  // Member intensive work, attemp to reduce crashing
  { concurrency: 10 },
);
