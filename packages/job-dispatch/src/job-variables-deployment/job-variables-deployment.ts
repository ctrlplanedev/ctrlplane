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
          value: value.value,
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
  value: any;
  directMatch: boolean;
  sensitive: boolean;
} | null> => {
  const resourceVariableValue = await utils.getResourceVariableValue(
    tx,
    jobResource.id,
    variableKey,
  );

  if (resourceVariableValue != null) {
    // Check if resource variable is a reference type
    if (
      resourceVariableValue.valueType === "reference" &&
      resourceVariableValue.reference &&
      resourceVariableValue.path
    ) {
      // Resolve reference type resource variable
      const resolvedValue = await utils.resolveDeploymentVariableReference<
        typeof resourceVariableValue.value
      >(tx, resourceVariableValue.reference, resourceVariableValue.path);

      // If resolution fails, use defaultValue if available
      const value = resolvedValue ?? resourceVariableValue.defaultValue;

      return {
        value,
        directMatch: true,
        sensitive: resourceVariableValue.sensitive,
      };
    }

    // Direct value type
    return {
      value: resourceVariableValue.value,
      directMatch: true,
      sensitive: resourceVariableValue.sensitive,
    };
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

  if (firstMatchedValue) {
    // Check if matched value is a reference type
    if (
      firstMatchedValue.valueType === "reference" &&
      firstMatchedValue.reference &&
      firstMatchedValue.path
    ) {
      // Resolve reference value
      const resolvedValue = await utils.resolveDeploymentVariableReference(
        tx,
        firstMatchedValue.reference,
        firstMatchedValue.path,
      );

      return {
        value: resolvedValue !== null ? resolvedValue : null,
        directMatch: true,
        sensitive: firstMatchedValue.sensitive,
      };
    }

    // Direct value type
    return {
      value: firstMatchedValue.value,
      directMatch: true,
      sensitive: firstMatchedValue.sensitive,
    };
  }

  if (defaultValue != null) {
    // Check if default value is a reference type
    if (
      defaultValue.valueType === "reference" &&
      defaultValue.reference &&
      defaultValue.path
    ) {
      // Resolve reference value
      const resolvedValue = await utils.resolveDeploymentVariableReference(
        tx,
        defaultValue.reference,
        defaultValue.path,
      );

      return {
        value: resolvedValue !== null ? resolvedValue : null,
        directMatch: true,
        sensitive: defaultValue.sensitive,
      };
    }

    // Direct value type
    return {
      value: defaultValue.value,
      directMatch: true,
      sensitive: defaultValue.sensitive,
    };
  }

  return null;
};
