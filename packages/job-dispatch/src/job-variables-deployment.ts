import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const createReleaseVariables = async (
  tx: Tx,
  jobId: string,
): Promise<void> => {
  // Fetch the job and its associated deployment
  const job = await tx
    .select()
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.releaseJobTrigger.jobId, schema.job.id),
    )
    .where(eq(schema.job.id, jobId))
    .then(takeFirstOrNull);

  if (job == null) throw new Error(`Job with id ${jobId} not found`);

  const jobVariables = await determineVariablesForReleaseJob(tx, {
    ...job.job,
    releaseJobTrigger: job.release_job_trigger,
  });

  if (jobVariables.length > 0)
    await tx.insert(schema.jobVariable).values(jobVariables);
};

const determineVariablesForReleaseJob = async (
  tx: Tx,
  job: schema.Job & { releaseJobTrigger: schema.ReleaseJobTrigger },
): Promise<schema.JobVariable[]> => {
  const variables = await tx
    .select()
    .from(schema.deploymentVariable)
    .innerJoin(
      schema.release,
      eq(schema.release.deploymentId, schema.deploymentVariable.deploymentId),
    )
    .where(eq(schema.release.id, job.releaseJobTrigger.releaseId));

  if (variables.length === 0) return [];

  const jobTarget = await tx
    .select()
    .from(schema.target)
    .where(eq(schema.target.id, job.releaseJobTrigger.targetId))
    .then(takeFirstOrNull);

  if (!jobTarget) throw new Error(`Target not found for job ${job.id}`);

  const jobVariables: schema.JobVariable[] = [];

  await Promise.all(
    variables.map((variable) =>
      determineReleaseVariableValue(
        tx,
        variable.deployment_variable.id,
        jobTarget,
      ).then((value) =>
        jobVariables.push({
          jobId: job.id,
          key: variable.deployment_variable.key,
          value: value.value,
        }),
      ),
    ),
  );

  return jobVariables;
};

const determineReleaseVariableValue = async (
  tx: Tx,
  variableId: string,
  jobTarget: schema.Target,
): Promise<schema.DeploymentVariableValue> => {
  // Check for a direct target match
  const directMatch = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueTarget,
      eq(
        schema.deploymentVariableValueTarget.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(
      and(
        eq(schema.deploymentVariableValue.variableId, variableId),
        eq(schema.deploymentVariableValueTarget.targetId, jobTarget.id),
      ),
    )
    .then(takeFirstOrNull);

  if (directMatch != null) return directMatch.deployment_variable_value;

  // Check for a match based on target filters
  const deploymentVariableValue = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueTargetFilter,
      eq(
        schema.deploymentVariableValueTargetFilter.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(eq(schema.deploymentVariableValue.variableId, variableId))
    .then(takeFirstOrNull);

  if (deploymentVariableValue != null) {
    const filterMatch = await tx
      .select()
      .from(schema.target)
      .where(
        schema.targetMatchesMetadata(
          tx,
          deploymentVariableValue.deployment_variable_value_target_filter
            .targetFilter,
        ),
      )
      .limit(1)
      .then(takeFirstOrNull);

    if (filterMatch != null)
      return deploymentVariableValue.deployment_variable_value;
  }

  // If no specific match is found, return the default value (if any)
  const defaultValue = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .where(eq(schema.deploymentVariableValue.variableId, variableId))
    .then(takeFirst);

  return defaultValue;
};
