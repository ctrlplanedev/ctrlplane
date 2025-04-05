import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { createRelease } from "@ctrlplane/rule-engine";

export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    const { data } = job;
    const { key, resourceId } = data;
    const { deploymentIds, resource } = await db
      .select()
      .from(schema.resource)
      .innerJoin(
        schema.system,
        eq(schema.resource.workspaceId, schema.system.workspaceId),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .innerJoin(
        schema.deploymentVariable,
        eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
      )
      .where(
        and(
          eq(schema.resource.id, resourceId),
          eq(schema.deploymentVariable.key, key),
        ),
      )
      .then((results) => ({
        deploymentIds: results.map((result) => result.deployment.id),
        resource: results[0]?.resource,
      }));

    if (resource == null) throw new Error("Resource not found");

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: and(
        eq(schema.releaseTarget.resourceId, resourceId),
        inArray(schema.releaseTarget.deploymentId, deploymentIds),
      ),
    });

    const createReleasePromises = releaseTargets.map((rt) =>
      createRelease(db, rt, resource.workspaceId),
    );
    await Promise.all(createReleasePromises);

    await getQueue(Channel.EvaluateReleaseTarget).addBulk(
      releaseTargets.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      })),
    );
  },
);
