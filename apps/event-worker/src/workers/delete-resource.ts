import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

const softDeleteResource = async (tx: Tx, resource: SCHEMA.Resource) =>
  tx
    .update(SCHEMA.resource)
    .set({ deletedAt: new Date() })
    .where(eq(SCHEMA.resource.id, resource.id));

const deleteReleaseTargets = async (tx: Tx, resource: SCHEMA.Resource) =>
  tx
    .delete(SCHEMA.releaseTarget)
    .where(eq(SCHEMA.releaseTarget.resourceId, resource.id))
    .returning();

const deleteComputedResources = async (tx: Tx, resource: SCHEMA.Resource) =>
  Promise.all([
    tx
      .delete(SCHEMA.computedDeploymentResource)
      .where(eq(SCHEMA.computedDeploymentResource.resourceId, resource.id)),
    tx
      .delete(SCHEMA.computedEnvironmentResource)
      .where(eq(SCHEMA.computedEnvironmentResource.resourceId, resource.id)),
  ]);

export const deleteResourceWorker = createWorker(
  Channel.DeleteResource,
  async ({ data: resource }) => {
    await db.transaction(async (tx) => {
      await softDeleteResource(tx, resource);
      await deleteComputedResources(tx, resource);
      const rts = await deleteReleaseTargets(tx, resource);
      for (const rt of rts)
        getQueue(Channel.DeletedReleaseTarget).add(rt.id, rt, {
          deduplication: { id: rt.id },
        });
    });
  },
);
