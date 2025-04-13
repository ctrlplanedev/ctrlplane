import type { Tx } from "@ctrlplane/db";
import { trace } from "@opentelemetry/api";
import _ from "lodash";
import { withSpan } from "src/utils/spans.js";

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
const tracer = trace.getTracer("evaluate-release-target");
const withEvaluateReleaseTargetSpan = withSpan(tracer);

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
  return withEvaluateReleaseTargetSpan(
    "createRelease",
    async (span) => {
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

      span.setAttribute("job.id", job.id);
      span.setAttribute("job.jobAgentId", jobAgent.id);

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
    {
      "release.id": release.id,
      "release.versionReleaseId": release.versionReleaseId,
      "release.variableReleaseId": release.variableReleaseId,
    },
  );
};

/**
 * Handles version release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created version release
 * @throws Error if no candidate is chosen
 */
const handleVersionRelease = async (releaseTarget: any) => {
  return withEvaluateReleaseTargetSpan(
    "handleVersionRelease",
    async (span) => {
      const vrm = new VersionReleaseManager(db, {
        ...releaseTarget,
        workspaceId: releaseTarget.resource.workspaceId,
      });

      const { chosenCandidate } = await withEvaluateReleaseTargetSpan(
        "evaluateVersions",
        async (evaluateSpan) => {
          const result = await vrm.evaluate();
          if (result.chosenCandidate) {
            evaluateSpan.setAttribute(
              "candidate.id",
              result.chosenCandidate.id,
            );
          }
          return result;
        },
      );

      if (!chosenCandidate) {
        log.info("No valid version release found.", { releaseTarget });
        return null;
      }

      span.setAttribute("chosenCandidate.id", chosenCandidate.id);

      const { release: versionRelease } = await withEvaluateReleaseTargetSpan(
        "upsertVersionRelease",
        async (upsertSpan) => {
          const result = await vrm.upsertRelease(chosenCandidate.id);
          upsertSpan.setAttribute("versionRelease.id", result.release.id);
          return result;
        },
      );

      span.setAttribute("versionRelease.id", versionRelease.id);
      return versionRelease;
    },
    {
      "releaseTarget.id": String(releaseTarget.id),
      "releaseTarget.workspaceId": releaseTarget.resource.workspaceId,
    },
  );
};

/**
 * Handles variable release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created variable release
 */
const handleVariableRelease = async (releaseTarget: any) => {
  return withEvaluateReleaseTargetSpan(
    "handleVariableRelease",
    async (span) => {
      const varrm = new VariableReleaseManager(db, {
        ...releaseTarget,
        workspaceId: releaseTarget.resource.workspaceId,
      });

      const { chosenCandidate: variableValues } =
        await withEvaluateReleaseTargetSpan("evaluateVariables", async () =>
          varrm.evaluate(),
        );

      const { release: variableRelease } = await withEvaluateReleaseTargetSpan(
        "upsertVariableRelease",
        async (upsertSpan) => {
          const result = await varrm.upsertRelease(variableValues);
          upsertSpan.setAttribute("variableRelease.id", result.release.id);
          return result;
        },
      );

      span.setAttribute("variableRelease.id", variableRelease.id);
      return variableRelease;
    },
    {
      "releaseTarget.id": String(releaseTarget.id),
      "releaseTarget.workspaceId": releaseTarget.resource.workspaceId,
    },
  );
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

    return withEvaluateReleaseTargetSpan(
      "evaluateReleaseTarget",
      async (span) => {
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

          span.setAttribute("releaseTarget.id", String(releaseTarget.id));

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

          span.setAttribute("release.id", release.id);

          if (env.NODE_ENV === "development") {
            const job = await db.transaction((tx) =>
              createRelease(tx, release),
            );
            getQueue(Channel.DispatchJob).add(job.id, { jobId: job.id });
            span.setAttribute("dispatchedJob.id", job.id);
          }
        } finally {
          await mutex.unlock();
        }
      },
      {
        "job.name": job.name,
        "resource.id": job.data.resourceId,
        "environment.id": job.data.environmentId,
        "deployment.id": job.data.deploymentId,
      },
    );
  },
  // Member intensive work, attemp to reduce crashing
  { concurrency: 10 },
);
