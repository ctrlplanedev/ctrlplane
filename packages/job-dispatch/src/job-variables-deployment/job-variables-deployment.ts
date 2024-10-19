import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import * as schema from "@ctrlplane/db/schema";

import * as utils from "./utils.js";

export const createReleaseVariables = async (
  tx: Tx,
  jobId: string,
): Promise<void> => {
  // Fetch the job and its associated deployment
  const job = await utils.getJob(tx, jobId);

  if (job == null) throw new Error(`Job with id ${jobId} not found`);

  const jobVariables = await determineVariablesForReleaseJob(tx, {
    ...job.job,
    releaseJobTrigger: job.release_job_trigger,
  });

  if (jobVariables.length > 0)
    await tx.insert(schema.jobVariable).values(jobVariables);
};

export const determineVariablesForReleaseJob = async (
  tx: Tx,
  job: schema.Job & { releaseJobTrigger: schema.ReleaseJobTrigger },
): Promise<schema.JobVariable[]> => {
  const variables = await utils.getDeploymentVariables(
    tx,
    job.releaseJobTrigger.releaseId,
  );

  if (variables.length === 0) return [];

  const jobTarget = await utils.getTarget(tx, job.releaseJobTrigger.targetId);

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

  const envVariableSets = await utils.getEnvironment(
    tx,
    job.releaseJobTrigger.environmentId,
  );

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

export const determineReleaseVariableValue = async (
  tx: Tx,
  variableId: string,
  defaultValueId: string | null,
  jobTarget: schema.Target,
): Promise<{
  value: schema.DeploymentVariableValue;
  directMatch: boolean;
} | null> => {
  const deploymentVariableValues = await utils.getVariableValues(
    tx,
    variableId,
  );

  if (deploymentVariableValues.length === 0) return null;

  const defaultValue = deploymentVariableValues.find(
    (v) => v.id === defaultValueId,
  );
  const valuesWithFilters = deploymentVariableValues.filter(
    (v) => v.targetFilter != null,
  );

  const valuesMatchedByFilter = await Promise.all(
    valuesWithFilters.map(async (value) => {
      const matchedTarget = await utils.getMatchedTarget(
        tx,
        jobTarget.id,
        value.targetFilter,
      );

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
