import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, desc, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { ReleaseManager } from "@ctrlplane/release-manager";

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

const evaluatedQueue = getQueue(Channel.PolicyEvaluate);

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    const resources = await getDeploymentResources(db, job.data);

    const latestVersion = await db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.deploymentId, job.data.id),
      orderBy: desc(schema.deploymentVersion.createdAt),
    });

    if (latestVersion == null) throw new Error("No deployment version found");

    const releaseTargets = await db
      .insert(schema.releaseTarget)
      .values(
        resources.map((r) => ({
          resourceId: r.id,
          environmentId: r.environment.id,
          deploymentId: job.data.id,
        })),
      )
      .onConflictDoNothing()
      .returning();

    await Promise.all(
      releaseTargets.map(async (rt) => {
        const releaseManager = await ReleaseManager.usingDatabase(rt);
        await releaseManager.upsertVersionRelease(latestVersion.id, {
          setAsDesired: true,
        });
      }),
    );

    const jobData = resources.map((r) => {
      const resourceId = r.id;
      const environmentId = r.environment.id;
      const deploymentId = job.data.id;
      return {
        name: `${resourceId}-${environmentId}-${deploymentId}`,
        data: { resourceId, environmentId, deploymentId },
      };
    });

    await evaluatedQueue.addBulk(jobData);
  },
);
