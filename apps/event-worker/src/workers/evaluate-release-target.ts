import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, desc, eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger, makeWithSpan, trace } from "@ctrlplane/logger";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";

import { createAndAcquireMutex } from "../releases/mutex.js";

const log = logger.child({ worker: "evaluate-release-target" });
const tracer = trace.getTracer("evaluate-release-target");
const withSpan = makeWithSpan(tracer);

/**
 * Creates a new release job with the given version and variable releases
 * @param tx - Database transaction
 * @param release - Release object containing version and variable release IDs
 * @returns Created job
 * @throws Error if version release, job agent, or variable release not found
 */
const createRelease = withSpan(
  "createRelease",
  async (
    span,
    tx: Tx,
    release: {
      id: string;
      versionReleaseId: string;
      variableReleaseId: string;
    },
  ) => {
    span.setAttribute("release.id", release.id);
    span.setAttribute("versionRelease.id", release.versionReleaseId);
    span.setAttribute("variableRelease.id", release.variableReleaseId);

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
  },
);

/**
 * Handles version release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created version release
 * @throws Error if no candidate is chosen
 */
const handleVersionRelease = withSpan(
  "handleVersionRelease",
  async (span, releaseTarget: any) => {
    const workspaceId = releaseTarget.resource.workspaceId;

    span.setAttribute("releaseTarget.id", String(releaseTarget.id));
    span.setAttribute("workspace.id", workspaceId);

    const vrm = new VersionReleaseManager(db, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate } = await vrm.evaluate();

    if (!chosenCandidate) {
      log.info("No valid version release found.", { releaseTarget });
      return null;
    }

    const { release: versionRelease } = await vrm.upsertRelease(
      chosenCandidate.id,
    );

    return versionRelease;
  },
);
/**
 * Handles variable release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created variable release
 */
const handleVariableRelease = withSpan(
  "handleVariableRelease",
  async (span, releaseTarget: any) => {
    const workspaceId = releaseTarget.resource.workspaceId;

    span.setAttribute("releaseTarget.id", String(releaseTarget.id));
    span.setAttribute("workspace.id", workspaceId);

    const varrm = new VariableReleaseManager(db, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate: variableValues } = await varrm.evaluate();

    const { release: variableRelease } =
      await varrm.upsertRelease(variableValues);

    return variableRelease;
  },
);

/**
 * Worker that evaluates a release target and creates necessary releases and jobs
 * Only runs in development environment
 * Uses mutex to prevent concurrent evaluations of the same target
 */
export const evaluateReleaseTargetWorker = createWorker(
  Channel.EvaluateReleaseTarget,
  withSpan("evaluateReleaseTarget", async (span, job) => {
    span.setAttribute("resource.id", job.data.resourceId);
    span.setAttribute("environment.id", job.data.environmentId);
    span.setAttribute("deployment.id", job.data.deploymentId);

    log.info(`Evaluating release target ${job.data.resourceId}`, {
      jobId: job.id,
    });

    const mutex = await createAndAcquireMutex(job.data);

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

      const existingVersionRelease = await db.query.versionRelease.findFirst({
        where: eq(schema.versionRelease.releaseTargetId, releaseTarget.id),
        orderBy: desc(schema.versionRelease.createdAt),
      });

      const existingVariableRelease =
        await db.query.variableSetRelease.findFirst({
          where: eq(
            schema.variableSetRelease.releaseTargetId,
            releaseTarget.id,
          ),
          orderBy: desc(schema.variableSetRelease.createdAt),
        });

      const [versionRelease, variableRelease] = await Promise.all([
        handleVersionRelease(releaseTarget),
        handleVariableRelease(releaseTarget),
      ]);

      if (versionRelease == null) {
        log.info("No valid version release found.", { releaseTarget });
        return;
      }

      const isSameVersionRelease =
        existingVersionRelease?.id === versionRelease.id;
      const isSameVariableRelease =
        existingVariableRelease?.id === variableRelease.id;
      if (isSameVersionRelease && isSameVariableRelease) return;

      log.info("Creating new release for target", {
        releaseTarget,
        existingVersionRelease,
        versionRelease,
        existingVariableRelease,
        variableRelease,
      });

      const release = await db
        .insert(schema.release)
        .values({
          versionReleaseId: versionRelease.id,
          variableReleaseId: variableRelease.id,
        })
        .returning()
        .then(takeFirst);

      if (process.env.ENABLE_NEW_POLICY_ENGINE === "true") {
        const job = await db.transaction((tx) => createRelease(tx, release));
        getQueue(Channel.DispatchJob).add(job.id, { jobId: job.id });
      }
    } finally {
      await mutex.unlock();
    }
  }),
  // Member intensive work, attemp to reduce crashing
  { concurrency: 10 },
);
