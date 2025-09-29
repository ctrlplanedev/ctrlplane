import type { Tx } from "@ctrlplane/db";
import type { VersionEvaluateOptions } from "@ctrlplane/rule-engine";
import _ from "lodash";

import { and, desc, eq, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
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
const { createSpanWrapper: withSpan } = makeWithSpan(tracer);
const log = logger.child({ module: "evaluate-release-target" });

const getReleaseTarget = async (
  tx: Tx,
  identifier: {
    resourceId: string;
    environmentId: string;
    deploymentId: string;
  },
) => {
  const releaseTarget = await tx.query.releaseTarget.findFirst({
    where: and(
      eq(schema.releaseTarget.resourceId, identifier.resourceId),
      eq(schema.releaseTarget.environmentId, identifier.environmentId),
      eq(schema.releaseTarget.deploymentId, identifier.deploymentId),
    ),
    with: {
      resource: true,
      environment: true,
      deployment: true,
    },
  });

  if (releaseTarget == null)
    throw new Error(
      `Release target not found: resourceId=${identifier.resourceId} environmentId=${identifier.environmentId} deploymentId=${identifier.deploymentId}`,
    );

  return releaseTarget;
};

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
 * Gets the current release for a specific release target
 */
const getCurrentRelease = async (tx: Tx, releaseTargetId: string) => {
  const currentRelease = await tx
    .select()
    .from(schema.release)
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.variableSetRelease,
      eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
    )
    .where(eq(schema.versionRelease.releaseTargetId, releaseTargetId))
    .orderBy(desc(schema.release.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  if (currentRelease == null) return null;

  return {
    ...currentRelease.release,
    currentVersionRelease: currentRelease.version_release,
    currentVariableRelease: currentRelease.variable_set_release,
  };
};

const getHasAnythingChanged = (
  currentRelease: {
    currentVersionRelease: { id: string };
    currentVariableRelease: { id: string };
  },
  newRelease: { versionReleaseId: string; variableReleaseId: string },
) => {
  const isVersionUnchanged =
    currentRelease.currentVersionRelease.id === newRelease.versionReleaseId;
  const areVariablesUnchanged =
    currentRelease.currentVariableRelease.id === newRelease.variableReleaseId;
  return !isVersionUnchanged || !areVariablesUnchanged;
};

const insertNewRelease = async (
  tx: Tx,
  versionReleaseId: string,
  variableReleaseId: string,
) =>
  tx
    .insert(schema.release)
    .values({ versionReleaseId, variableReleaseId })
    .returning()
    .then(takeFirst);

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

    try {
      const release = await db.transaction(async (tx) => {
        const releaseTarget = await getReleaseTarget(tx, data);
        await acquireReleaseTargetLock(tx, releaseTarget.id);

        const { versionEvaluateOptions } = data;
        const [versionRelease, variableRelease] = await Promise.all([
          handleVersionRelease(tx, releaseTarget, versionEvaluateOptions),
          handleVariableRelease(tx, releaseTarget),
        ]);

        if (versionRelease == null) return;

        const currentRelease = await getCurrentRelease(tx, releaseTarget.id);
        if (currentRelease == null)
          return insertNewRelease(tx, versionRelease.id, variableRelease.id);

        const hasAnythingChanged = getHasAnythingChanged(currentRelease, {
          versionReleaseId: versionRelease.id,
          variableReleaseId: variableRelease.id,
        });

        if (!hasAnythingChanged) return currentRelease;

        return insertNewRelease(tx, versionRelease.id, variableRelease.id);
      });

      if (release == null) return;

      // Check if a job already exists for this release
      const existingReleaseJob = await db.query.releaseJob.findFirst({
        where: eq(schema.releaseJob.releaseId, release.id),
      });

      if (existingReleaseJob != null && !skipDuplicateCheck) return;

      // If no job exists yet, create one and dispatch it
      const newReleaseJob = await db.transaction(async (tx) =>
        createReleaseJob(tx, release),
      );

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
