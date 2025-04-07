import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { DatabaseReleaseRepository } from "@ctrlplane/rule-engine";

/**
 * Worker that handles deployment variable changes by triggering evaluations for
 * all existing release targets related to that deployment. This keeps the logic
 * simple by re-evaluating all affected releases.
 *
 * Note: This assumes that release targets have been correctly created
 * previously. The worker only handles re-evaluation of existing targets.
 */
export const updateDeploymentVariableWorker = createWorker(
  Channel.UpdateDeploymentVariable,
  async (job) => {
    const variable = await db.query.deploymentVariable.findFirst({
      where: eq(schema.deploymentVariable.id, job.data.id),
      with: { deployment: { with: { system: true } } },
    });

    if (variable == null) throw new Error("Deployment variable not found");

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: eq(schema.releaseTarget.deploymentId, variable.deploymentId),
    });

    const { deployment } = variable;
    const { system } = deployment;
    const { workspaceId } = system;

    const updateReleaseVariablePromises = releaseTargets.map(async (rt) => {
      const releaseRepository = await DatabaseReleaseRepository.create({
        ...rt,
        workspaceId,
      });
      const variables = await releaseRepository.getLatestVariables();
      await releaseRepository.updateReleaseVariables(variables);
    });
    await Promise.all(updateReleaseVariablePromises);

    await getQueue(Channel.EvaluateReleaseTarget).addBulk(
      releaseTargets.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      })),
    );
  },
);
