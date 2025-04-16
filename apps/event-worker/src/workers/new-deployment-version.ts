import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

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
      with: { system: true },
    });

    if (!deployment) throw new Error("Deployment not found");

    const computedResources = await db
      .select()
      .from(schema.computedDeploymentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
      )
      .where(
        eq(
          schema.computedDeploymentResource.deploymentId,
          version.deploymentId,
        ),
      );
    const resources = computedResources.map((r) => r.resource);

    const targetPromises = resources.map((r) => upsertReleaseTargets(db, r));
    const fulfilled = await Promise.all(targetPromises);
    const releaseTargets = fulfilled.flat();

    await getQueue(Channel.EvaluateReleaseTarget).addBulk(
      releaseTargets.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      })),
    );
  },
);
