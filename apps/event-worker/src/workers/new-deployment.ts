import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import { and, eq, isNull, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

const getDeploymentResources = async (
  tx: Tx,
  deployment: {
    id: string;
    systemId: string;
    resourceSelector?: ResourceCondition | null;
  },
) => {
  const system = await tx.query.system.findFirst({
    where: eq(schema.system.id, deployment.systemId),
    with: { environments: true },
  });

  if (system == null) throw new Error("System or deployment not found");

  const { environments } = system;

  // Simplify the chained operations with standard Promise.all
  const resources = await Promise.all(
    environments.map(async (env) => {
      if (env.resourceSelector == null) return [];

      const res = await tx
        .select()
        .from(schema.resource)
        .where(
          and(
            eq(schema.resource.workspaceId, system.workspaceId),
            isNull(schema.resource.deletedAt),
            schema.resourceMatchesMetadata(tx, env.resourceSelector),
            schema.resourceMatchesMetadata(tx, deployment.resourceSelector),
          ),
        );
      return res.map((r) => ({ ...r, environment: env }));
    }),
  ).then((arrays) => arrays.flat());

  return resources;
};

const evaluatedQueue = getQueue(Channel.EvaluateReleaseTarget);

const recomputeAllPolicyDeployments = async (tx: Tx, systemId: string) => {
  const system = await tx.query.system.findFirst({
    where: eq(schema.system.id, systemId),
  });
  if (system == null) throw new Error(`System not found: ${systemId}`);
  const { workspaceId } = system;
  await selector(tx)
    .compute()
    .allPolicies(workspaceId)
    .deploymentSelectors()
    .replace();
};

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    const resources = await getDeploymentResources(db, job.data);
    const jobData = resources.map((r) => {
      const resourceId = r.id;
      const environmentId = r.environment.id;
      const deploymentId = job.data.id;
      return {
        name: `${resourceId}-${environmentId}-${deploymentId}`,
        data: { resourceId, environmentId, deploymentId },
      };
    });
    recomputeAllPolicyDeployments(db, job.data.systemId).then(() =>
      evaluatedQueue.addBulk(jobData),
    );
  },
);
