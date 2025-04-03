import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { createReleases } from "src/releases/create-release";

import { and, desc, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

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

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async ({ data: deployment }) => {
    const latestVersion = await db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.deploymentId, deployment.id),
      orderBy: desc(schema.deploymentVersion.createdAt),
    });

    if (latestVersion == null) throw new Error("No deployment version found");

    const resources = await getDeploymentResources(db, deployment);

    const releaseTargets = resources.map((r) => ({
      resourceId: r.id,
      environmentId: r.environment.id,
      deploymentId: deployment.id,
      versionId: latestVersion.id,
    }));

    await createReleases(releaseTargets);
  },
);
