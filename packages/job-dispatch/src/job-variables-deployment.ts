import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
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

  const directMatches: string[] = [];

  await Promise.all(
    variables.map((variable) =>
      determineReleaseVariableValue(
        tx,
        variable.deployment_variable.id,
        variable.deployment_variable.defaultValueId,
        jobTarget,
      ).then((value) => {
        if (value == null) return;

        jobVariables.push({
          jobId: job.id,
          key: variable.deployment_variable.key,
          value: value.value.value,
        });

        if (value.directMatch)
          directMatches.push(variable.deployment_variable.key);
      }),
    ),
  );

  const envVariableSets = await tx.query.environment.findMany({
    where: eq(schema.environment.id, job.releaseJobTrigger.environmentId),
    with: {
      assignments: { with: { variableSet: { with: { values: true } } } },
    },
  });

  envVariableSets.forEach((env) => {
    env.assignments.forEach((assignment) => {
      const { variableSet } = assignment;
      variableSet.values.forEach((val) => {
        const existingKeys = jobVariables.map((v) => v.key);

        if (!existingKeys.includes(val.key)) {
          jobVariables.push({
            jobId: job.id,
            key: val.key,
            value: val.value,
          });
          directMatches.push(val.key);
          return;
        }

        if (directMatches.includes(val.key)) return;

        const existingVariableIdx = jobVariables.findIndex(
          (v) => v.key === val.key,
        );

        if (existingVariableIdx === -1) return;

        jobVariables[existingVariableIdx]!.value = val.value;
        directMatches.push(val.key);
      });
    });
  });

  return jobVariables;
};

const determineReleaseVariableValue = async (
  tx: Tx,
  variableId: string,
  defaultValueId: string | null,
  jobTarget: schema.Target,
): Promise<{
  value: schema.DeploymentVariableValue;
  directMatch: boolean;
} | null> => {
  const deploymentVariableValues = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .orderBy(schema.deploymentVariableValue.value)
    .where(eq(schema.deploymentVariableValue.variableId, variableId));

  if (deploymentVariableValues.length === 0) return null;

  const defaultValue = deploymentVariableValues.find(
    (v) => v.id === defaultValueId,
  );
  const valuesWithFilters = deploymentVariableValues.filter(
    (v) => v.targetFilter != null,
  );

  const valuesMatchedByFilter = await Promise.all(
    valuesWithFilters.map(async (value) => {
      const matchedTarget = await tx
        .select()
        .from(schema.target)
        .where(
          and(
            eq(schema.target.id, jobTarget.id),
            schema.targetMatchesMetadata(tx, value.targetFilter),
          ),
        )
        .then(takeFirstOrNull);

      if (matchedTarget != null) return value;
    }),
  ).then((values) => values.filter(isPresent));

  if (valuesMatchedByFilter.length > 0)
    return {
      value: valuesMatchedByFilter[0]!,
      directMatch: true,
    };

  if (defaultValue != null)
    return {
      value: defaultValue,
      directMatch: true,
    };

  return {
    value: deploymentVariableValues[0]!,
    directMatch: false,
  };
};
