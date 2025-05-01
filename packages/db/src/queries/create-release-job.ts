import { eq } from "drizzle-orm";
import _ from "lodash";

import type { Tx } from "../common.js";
import { takeFirstOrNull } from "../common.js";
import * as schema from "../schema/index.js";

/**
 * Creates a new release job with the given version and variable releases
 * @param tx - Database transaction
 * @param release - Release object containing version and variable release IDs
 * @returns Created job
 * @throws Error if version release, job agent, or variable release not found
 */
export const createReleaseJob = async (
  tx: Tx,
  release: {
    id: string;
    versionReleaseId: string;
    variableReleaseId: string;
  },
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
      reason: "policy_passing", // Keep using valid reason type
    })
    .returning()
    .then(takeFirstOrNull);

  if (job == null) throw new Error("Failed to create job");

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
