import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

import { createReleases } from "../releases/create-release.js";

const getDeploymentResources = async (
  tx: Tx,
  deployment: schema.Deployment,
) => {
  const system = await tx.query.system.findFirst({
    where: eq(schema.system.id, deployment.systemId),
    with: { environments: true },
  });

  if (system == null) throw new Error("System or deployment not found");

  const { environments } = system;
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

/**
 * Worker that handles new deployment versions. When a new version is created
 * for a deployment:
 * 1. Finds the associated deployment
 * 2. Gets all resources that match both the deployment's and environments'
 *    resource selectors
 * 3. Creates release targets mapping resources to environments for this
 *    deployment
 * 4. Creates releases for all targets with the new version, which will trigger
 *    policy evaluation
 */
export const newDeploymentVersionWorker = createWorker(
  Channel.NewDeploymentVersion,
  async ({ data: version }) => {
    const deployment = await db.query.deployment.findFirst({
      where: eq(schema.deployment.id, version.deploymentId),
    });

    if (!deployment) throw new Error("Deployment not found");

    const resources = await getDeploymentResources(db, deployment);

    const releaseTargets = resources.map((resource) => ({
      resourceId: resource.id,
      environmentId: resource.environment.id,
      deploymentId: version.deploymentId,
      versionId: version.id,
    }));

    await createReleases(releaseTargets);
  },
);
