import type { Tx } from "@ctrlplane/db";
import type { DeploymentVariableValue, Target } from "@ctrlplane/db/schema";

import {
  and,
  arrayContains,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

export const determineVariablesForReleaseJob = async (
  tx: Tx,
  job: SCHEMA.Job & { releaseJobTrigger: SCHEMA.ReleaseJobTrigger },
): Promise<SCHEMA.JobVariable[]> => {
  const variables = await tx
    .select()
    .from(SCHEMA.deploymentVariable)
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.release.deploymentId, SCHEMA.deploymentVariable.deploymentId),
    )
    .where(eq(SCHEMA.release.id, job.releaseJobTrigger.releaseId));

  if (variables.length === 0) return [];

  const jobTarget = await tx
    .select()
    .from(SCHEMA.target)
    .where(eq(SCHEMA.target.id, job.releaseJobTrigger.targetId))
    .then(takeFirstOrNull);

  if (!jobTarget) throw new Error(`Target not found for job ${job.id}`);

  const jobVariables: SCHEMA.JobVariable[] = [];

  await Promise.all(
    variables.map(async (variable) => {
      const value = await determineReleaseVariableValue(
        tx,
        variable.deployment_variable.id,
        jobTarget,
      );

      if (value != null) {
        jobVariables.push({
          jobId: job.id,
          key: variable.deployment_variable.key,
          value: value.value,
        });
        return;
      }

      logger.warn(
        `No value found for variable ${variable.deployment_variable.key} in job ${job.id}`,
      );
    }),
  );

  return jobVariables;
};

const determineReleaseVariableValue = async (
  tx: Tx,
  variableId: string,
  jobTarget: Target,
): Promise<DeploymentVariableValue | null> => {
  // Check for a direct target match
  const directMatch = await tx
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .innerJoin(
      SCHEMA.deploymentVariableValueTarget,
      eq(
        SCHEMA.deploymentVariableValueTarget.variableValueId,
        SCHEMA.deploymentVariableValue.id,
      ),
    )
    .where(
      and(
        eq(SCHEMA.deploymentVariableValue.variableId, variableId),
        eq(SCHEMA.deploymentVariableValueTarget.targetId, jobTarget.id),
      ),
    )
    .then(takeFirstOrNull);

  if (directMatch != null) return directMatch.deployment_variable_value;

  // Check for a match based on target filters
  const filterMatch = await tx
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .innerJoin(
      SCHEMA.deploymentVariableValueTargetFilter,
      eq(
        SCHEMA.deploymentVariableValueTargetFilter.variableValueId,
        SCHEMA.deploymentVariableValue.id,
      ),
    )
    .innerJoin(
      SCHEMA.target,
      arrayContains(
        SCHEMA.target.labels,
        SCHEMA.deploymentVariableValueTargetFilter.labels,
      ),
    )
    .where(
      and(
        eq(SCHEMA.deploymentVariableValue.variableId, variableId),
        eq(SCHEMA.target.id, jobTarget.id),
      ),
    )
    .then(takeFirstOrNull);

  if (filterMatch) return filterMatch.deployment_variable_value;

  // If no specific match is found, return the default value (if any)
  const defaultValue = await tx
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .where(eq(SCHEMA.deploymentVariableValue.variableId, variableId))
    .then(takeFirst);

  return defaultValue;
};
