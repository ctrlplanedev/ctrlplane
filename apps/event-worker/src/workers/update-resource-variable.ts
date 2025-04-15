import { and, eq, inArray, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    const { data } = job;
    const { key, resourceId } = data;
    const rows = await db
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
      );

    const resource = rows[0]?.resource;
    if (!resource) throw new Error("Resource not found");

    const deploymentIds = rows.map((row) => row.deployment.id);

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: and(
        eq(schema.releaseTarget.resourceId, resourceId),
        inArray(schema.releaseTarget.deploymentId, deploymentIds),
      ),
    });

    selector(db)
      .compute()
      .allPolicies(resource.workspaceId)
      .resourceSelectors()
      .replace()
      .then(() =>
        getQueue(Channel.EvaluateReleaseTarget).addBulk(
          releaseTargets.map((rt) => ({
            name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
            data: rt,
          })),
        ),
      );
  },
);
