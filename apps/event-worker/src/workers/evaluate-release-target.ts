import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, desc, eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { makeWithSpan, trace } from "@ctrlplane/logger";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";

const tracer = trace.getTracer("evaluate-release-target");
const withSpan = makeWithSpan(tracer);

/**
 * Handles version release evaluation and creation for a release target
 * @param releaseTarget - Release target to evaluate
 * @returns Created version release
 * @throws Error if no candidate is chosen
 */
const handleVersionRelease = withSpan(
  "handleVersionRelease",
  async (span, tx: Tx, releaseTarget: any) => {
    const workspaceId = releaseTarget.resource.workspaceId;

    span.setAttribute("releaseTarget.id", String(releaseTarget.id));
    span.setAttribute("workspace.id", workspaceId);

    const vrm = new VersionReleaseManager(tx, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate } = await vrm.evaluate();

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

        await tx.execute(
          sql`
            SELECT id FROM ${schema.releaseTarget}
            WHERE ${eq(schema.releaseTarget.id, releaseTarget.id)}
            FOR UPDATE NOWAIT
          `,
        );

        const existingVersionRelease = await tx.query.versionRelease.findFirst({
          where: eq(schema.versionRelease.releaseTargetId, releaseTarget.id),
          orderBy: desc(schema.versionRelease.createdAt),
        });

        const existingVariableRelease =
          await tx.query.variableSetRelease.findFirst({
            where: eq(
              schema.variableSetRelease.releaseTargetId,
              releaseTarget.id,
            ),
            orderBy: desc(schema.variableSetRelease.createdAt),
          });

        const [versionRelease, variableRelease] = await Promise.all([
          handleVersionRelease(tx, releaseTarget),
          handleVariableRelease(tx, releaseTarget),
        ]);

        if (versionRelease == null) return;

        const hasSameVersion = existingVersionRelease?.id === versionRelease.id;
        const hasSameVariables =
          existingVariableRelease?.id === variableRelease.id;

        if (hasSameVersion && hasSameVariables) {
          return tx.query.release.findFirst({
            where: and(
              eq(schema.release.versionReleaseId, versionRelease.id),
              eq(schema.release.variableReleaseId, variableRelease.id),
            ),
          });
        }

        return tx
          .insert(schema.release)
          .values({
            versionReleaseId: versionRelease.id,
            variableReleaseId: variableRelease.id,
          })
          .returning()
          .then(takeFirst);
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
      getQueue(Channel.DispatchJob).add(newReleaseJob.id, {
        jobId: newReleaseJob.id,
      });
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      const isReleaseTargetNotCommittedYet = e.code === "23503";
      if (isRowLocked || isReleaseTargetNotCommittedYet) {
        await getQueue(Channel.EvaluateReleaseTarget).add(job.name, job.data, {
          delay: 500,
        });
        return;
      }
      throw e;
    }
  }),
  // Member intensive work, attemp to reduce crashing
  { concurrency: 10 },
);
