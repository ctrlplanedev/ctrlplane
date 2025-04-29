import type { Tx } from "@ctrlplane/db";
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
    job.releaseJobTrigger.versionId,
  );

  if (variables.length === 0) return [];

  const jobResource = await utils.getResource(
    tx,
    job.releaseJobTrigger.resourceId,
  );

  if (!jobResource) throw new Error(`Resource not found for job ${job.id}`);

  const jobVariables: schema.JobVariable[] = [];

  const directMatches: string[] = [];

  await Promise.all(
    variables.map((variable) =>
      determineReleaseVariableValue(
        tx,
        variable.deployment_variable.key,
        variable.deployment_variable.id,
        variable.deployment_variable.defaultValueId,
        jobResource,
      ).then((value) => {
        if (value == null) return;

        jobVariables.push({
          jobId: job.id,
          key: variable.deployment_variable.key,
          value: value.value.value,
          sensitive: value.sensitive,
        });

        if (value.directMatch)
          directMatches.push(variable.deployment_variable.key);
      }),
    ),
  );

  const env = await utils.getEnvironment(
    tx,
    job.releaseJobTrigger.environmentId,
  );

  if (!env) return jobVariables;
  const environments = env.environments.sort((a, b) =>
    a.variableSet.name.localeCompare(b.variableSet.name),
  );

  for (const environment of environments) {
    const { variableSet } = environment;
    for (const val of variableSet.values) {
      const existingKeys = jobVariables.map((v) => v.key);
      if (!existingKeys.includes(val.key)) {
        jobVariables.push({
          jobId: job.id,
          key: val.key,
          value: val.value,
        });
        directMatches.push(val.key);
        continue;
      }

      if (directMatches.includes(val.key)) continue;

      const existingVariableIdx = jobVariables.findIndex(
        (v) => v.key === val.key,
      );

      if (existingVariableIdx === -1) continue;

      jobVariables[existingVariableIdx]!.value = val.value;
      directMatches.push(val.key);
    }
  }

  return jobVariables;
};

export const determineReleaseVariableValue = async (
  tx: Tx,
  variableKey: string,
  variableId: string,
  defaultValueId: string | null,
  jobResource: schema.Resource,
): Promise<{
  value: schema.DeploymentVariableValue | schema.ResourceVariable;
  directMatch: boolean;
  sensitive: boolean;
} | null> => {
  const resourceVariableValueRaw = await utils.getResourceVariableValue(
    tx,
    jobResource.id,
    variableKey,
  );

  if (resourceVariableValueRaw != null) {
    try {
      const parsedResourceVariable = schema.resourceVariableSchema.parse(
        resourceVariableValueRaw,
      );
      return {
        value: parsedResourceVariable,
        directMatch: true,
        sensitive: parsedResourceVariable.sensitive ?? false,
      };
    } catch (error) {
      console.error(
        `Error parsing resource variable ${variableKey} for resource ${jobResource.id}:`,
        error,
      );
      return null;
    }
  }

  const deploymentVariableValues = await utils.getVariableValues(
    tx,
    variableId,
  );

  if (deploymentVariableValues.length === 0) return null;

  const defaultValue = deploymentVariableValues.find(
    (v) => v.id === defaultValueId,
  );

  const valuesWithFilter = deploymentVariableValues.filter((v) =>
    isPresent(v.resourceSelector),
  );

  const firstMatchedValue = await utils.getFirstMatchedResource(
    tx,
    jobResource.id,
    valuesWithFilter,
  );

  if (firstMatchedValue != null)
    return {
      value: firstMatchedValue,
      directMatch: true,
      sensitive: false,
    };

  if (defaultValue != null)
    return {
      value: defaultValue,
      directMatch: false,
      sensitive: false,
    };

  return null;
};
