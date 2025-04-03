import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

const copyReleaseVariables = async (
  tx: Tx,
  jobId: string,
  releaseId: string,
): Promise<void> => {
  const releaseVars = await tx.query.releaseVariable.findMany({
    where: eq(schema.releaseVariable.releaseId, releaseId),
  });

  if (releaseVars.length === 0) return;

  await tx.insert(schema.jobVariable).values(
    releaseVars.map((v) => ({
      jobId,
      ..._.pick(v, ["key", "value", "sensitive"]),
    })),
  );
};

const getJobAgentConfig = async (tx: Tx, versionId: string) => {
  const { job_agent: jobAgent } =
    (await tx
      .select()
      .from(schema.deploymentVersion)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.jobAgent,
        eq(schema.deployment.jobAgentId, schema.jobAgent.id),
      )
      .where(eq(schema.deploymentVersion.id, versionId))
      .then(takeFirstOrNull)) ?? {};

  if (jobAgent == null)
    throw new Error(`Job agent not found for version ${versionId}`);
  return {
    jobAgentId: jobAgent.id,
    jobAgentConfig: _.merge({}, jobAgent.config),
  };
};

export const createJobFromRelease = async (
  release: typeof schema.release.$inferSelect,
) => {
  return db.transaction(async (tx) => {
    // Create the job
    const job = await tx
      .insert(schema.job)
      .values({
        status: JobStatus.Pending,
        ...(await getJobAgentConfig(tx, release.versionId)),
      })
      .returning()
      .then(takeFirstOrNull);

    if (job == null) return null;

    await copyReleaseVariables(tx, job.id, release.id);

    return job;
  });
};
