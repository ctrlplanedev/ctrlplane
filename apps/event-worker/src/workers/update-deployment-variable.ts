import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const updateDeploymentVariableQueue = getQueue(
  Channel.UpdateDeploymentVariable,
);

/**
 * Resolves a reference value by following a path to extract a specific value
 * from a referenced resource or object.
 *
 * @param reference The identifier of the referenced resource
 * @param path Array of keys to traverse in the referenced object
 * @returns The resolved value or null if the reference or path is invalid
 */
async function resolveReference<T = any>(
  reference: string,
  path: string[],
): Promise<T | null> {
  const resource = await db.query.resource.findFirst({
    where: and(
      eq(schema.resource.identifier, reference),
      isNull(schema.resource.deletedAt),
    ),
  });

  if (!resource) return null;

  let currentValue: Record<string, any> = resource.config;

  for (const key of path) {
    if (typeof currentValue !== "object") return null;
    currentValue = currentValue[key];
  }

  return currentValue as T;
}

/**
 * Worker that handles deployment variable changes
 *
 * When a deployment variable is updated, perform the following steps:
 * 1. Resolve any reference type variables (if applicable)
 * 2. Find variables that depend on this variable (if it's referenced by others)
 * 3. Grab all release targets associated with the deployment
 * 4. Add them to the evaluation queue
 *
 * @param {Job<ChannelMap[Channel.UpdateDeploymentVariable]>} job - The deployment variable data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const updateDeploymentVariableWorker = createWorker(
  Channel.UpdateDeploymentVariable,
  async (job) => {
    const variable = await db.query.deploymentVariable.findFirst({
      where: eq(schema.deploymentVariable.id, job.data.id),
      with: {
        deployment: { with: { system: true } },
        defaultValue: true,
      },
    });

    if (variable == null) throw new Error("Deployment variable not found");

    if (
      variable.defaultValue &&
      variable.defaultValue.valueType === "reference" &&
      variable.defaultValue.reference &&
      variable.defaultValue.path
    ) {
      const { reference, path } = variable.defaultValue;

      try {
        const resolvedValue = await resolveReference(reference, path);

        console.log(
          `Resolved reference for variable ${variable.key}:`,
          resolvedValue,
        );
      } catch (error) {
        console.error(
          `Failed to resolve reference for variable ${variable.key}:`,
          error,
        );
      }
    }

    // Find variables that might depend on this variable (reference it)
    // This is important for cascading updates when referenced variables change
    const dependentVariables = await db.query.deploymentVariableValue.findMany({
      where: eq(schema.deploymentVariableValue.reference, variable.key),
      with: {
        variable: true,
      },
    });

    for (const depVar of dependentVariables) {
      await db.transaction(async () => {
        await updateDeploymentVariableQueue.add(
          depVar.variable.id,
          depVar.variable,
        );
      });
    }

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: eq(schema.releaseTarget.deploymentId, variable.deploymentId),
    });

    await dispatchEvaluateJobs(releaseTargets);
  },
);
