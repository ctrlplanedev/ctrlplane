import type { Tx } from "@ctrlplane/db";
import type { VersionEvaluateOptions } from "@ctrlplane/rule-engine";
import _ from "lodash";

import { and, desc, eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import {
  Channel,
  createWorker,
  dispatchQueueJob,
  getQueue,
} from "@ctrlplane/events";
import { logger, makeWithSpan, trace } from "@ctrlplane/logger";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";

const tracer = trace.getTracer("evaluate-release-target");
const withSpan = makeWithSpan(tracer);
const log = logger.child({ module: "evaluate-release-target" });

/**
 * Handles version release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created version release
 * @throws Error if no candidate is chosen
 */
const handleVersionRelease = withSpan(
  "handleVersionRelease",
  async (
    span,
    tx: Tx,
    releaseTarget: any,
    versionEvaluateOptions?: VersionEvaluateOptions,
  ) => {
    const workspaceId = releaseTarget.resource.workspaceId;

    span.setAttribute("releaseTarget.id", String(releaseTarget.id));
    span.setAttribute("workspace.id", workspaceId);

    const vrm = new VersionReleaseManager(tx, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate } = await vrm.evaluate(versionEvaluateOptions);

    if (!chosenCandidate) return null;

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
  async (span, tx: Tx, releaseTarget: any) => {
    const workspaceId = releaseTarget.resource.workspaceId;

    span.setAttribute("releaseTarget.id", String(releaseTarget.id));
    span.setAttribute("workspace.id", workspaceId);

    const varrm = new VariableReleaseManager(tx, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate: variableValues } = await varrm.evaluate();

    const { release: variableRelease } =
      await varrm.upsertRelease(variableValues);

    return variableRelease;
  },
);

const acquireReleaseTargetLock = async (tx: Tx, releaseTargetId: string) =>
  tx.execute(
    sql`
    SELECT * FROM ${schema.releaseTarget}
    INNER JOIN ${schema.computedPolicyTargetReleaseTarget} ON ${eq(schema.computedPolicyTargetReleaseTarget.releaseTargetId, schema.releaseTarget.id)}
    INNER JOIN ${schema.policyTarget} ON ${eq(schema.computedPolicyTargetReleaseTarget.policyTargetId, schema.policyTarget.id)}
    WHERE ${eq(schema.releaseTarget.id, releaseTargetId)}
    FOR UPDATE NOWAIT
  `,
  );

/**
 * Gets the latest version release for a specific release target
 */
const getLatestVersionRelease = (tx: Tx, releaseTargetId: string) =>
  tx.query.versionRelease.findFirst({
    where: eq(schema.versionRelease.releaseTargetId, releaseTargetId),
    orderBy: desc(schema.versionRelease.createdAt),
  });

/**
 * Worker that evaluates a release target and creates necessary releases and jobs
 * Only runs in development environment
 * Uses mutex to prevent concurrent evaluations of the same target
 */
export const evaluateReleaseTargetWorker = createWorker(
  Channel.EvaluateReleaseTarget,
  withSpan("evaluateReleaseTarget", async (span, job) => {
    const data = job.data;
    const skipDuplicateCheck = data.skipDuplicateCheck ?? false;

    span.setAttribute("resource.id", data.resourceId);
    span.setAttribute("environment.id", data.environmentId);
    span.setAttribute("deployment.id", data.deploymentId);
    span.setAttribute("skipDuplicateCheck", skipDuplicateCheck);

    if (data.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99") {
      log.info("Evaluating release target", { data });
    }

    try {
      const release = await db.transaction(async (tx) => {
        const releaseTarget = await tx.query.releaseTarget.findFirst({
          where: and(
            eq(schema.releaseTarget.resourceId, data.resourceId),
            eq(schema.releaseTarget.environmentId, data.environmentId),
            eq(schema.releaseTarget.deploymentId, data.deploymentId),
          ),
          with: {
            resource: true,
            environment: true,
            deployment: true,
          },
        });

        if (releaseTarget == null)
          throw new Error("Failed to get release target");

        await acquireReleaseTargetLock(tx, releaseTarget.id);

        const latestVersionRelease = await getLatestVersionRelease(
          tx,
          releaseTarget.id,
        );

        if (
          releaseTarget.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99"
        ) {
          log.info("Latest version release", { latestVersionRelease });
        }

        const existingVariableRelease =
          await tx.query.variableSetRelease.findFirst({
            where: eq(
              schema.variableSetRelease.releaseTargetId,
              releaseTarget.id,
            ),
            orderBy: desc(schema.variableSetRelease.createdAt),
          });

        if (
          releaseTarget.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99"
        ) {
          log.info("Existing variable release", { existingVariableRelease });
        }

        const { versionEvaluateOptions } = data;
        const [versionRelease, variableRelease] = await Promise.all([
          handleVersionRelease(tx, releaseTarget, versionEvaluateOptions),
          handleVariableRelease(tx, releaseTarget),
        ]);

        if (
          releaseTarget.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99"
        ) {
          log.info("Version release", { versionRelease });
        }

        if (
          releaseTarget.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99"
        ) {
          log.info("Variable release", { variableRelease });
        }

        if (versionRelease == null) return;

        // Check if version and variables are unchanged from previous release
        const isVersionUnchanged =
          latestVersionRelease?.id === versionRelease.id;
        const areVariablesUnchanged =
          existingVariableRelease?.id === variableRelease.id;

        const hasAnythingChanged =
          !isVersionUnchanged || !areVariablesUnchanged;

        if (
          releaseTarget.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99"
        ) {
          log.info("Has anything changed", { hasAnythingChanged });
        }

        // If nothing changed, return existing release
        if (!hasAnythingChanged) {
          return tx.query.release.findFirst({
            where: and(
              eq(schema.release.versionReleaseId, versionRelease.id),
              eq(schema.release.variableReleaseId, variableRelease.id),
            ),
          });
        }

        // Otherwise create new release with updated version/variables
        const newRelease = {
          versionReleaseId: versionRelease.id,
          variableReleaseId: variableRelease.id,
        };

        return tx
          .insert(schema.release)
          .values(newRelease)
          .returning()
          .then(takeFirst);
      });

      if (data.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99") {
        log.info("Release", { release });
      }

      if (release == null) return;

      // Check if a job already exists for this release
      const existingReleaseJob = await db.query.releaseJob.findFirst({
        where: eq(schema.releaseJob.releaseId, release.id),
      });

      if (data.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99") {
        log.info("Existing release job", { existingReleaseJob });
      }

      if (existingReleaseJob != null && !skipDuplicateCheck) return;

      // If no job exists yet, create one and dispatch it
      const newReleaseJob = await db.transaction(async (tx) =>
        createReleaseJob(tx, release),
      );

      if (data.resourceId === "af9bbe15-3f4a-4716-9ef8-3bc3812b8c99") {
        log.info("Created release job", { newReleaseJob });
      }

      log.info("Created release job", {
        releaseId: release.id,
        job: newReleaseJob,
      });
      getQueue(Channel.DispatchJob).add(newReleaseJob.id, {
        jobId: newReleaseJob.id,
      });
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      const isReleaseTargetNotCommittedYet = e.code === "23503";
      if (isRowLocked || isReleaseTargetNotCommittedYet) {
        dispatchQueueJob().toEvaluate().releaseTargets([job.data]);
        return;
      }
      const isJobAgentError =
        e.message === "Deployment has no Job Agent" ||
        e === "Deployment has no Job Agent";
      if (!isJobAgentError)
        log.error("Failed to evaluate release target", { error: e });
      throw e;
    }
  }),
  // Member intensive work, attemp to reduce crashing
  { concurrency: 10 },
);
