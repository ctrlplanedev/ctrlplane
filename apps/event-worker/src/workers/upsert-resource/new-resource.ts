import type { Tx } from "@ctrlplane/db";
import type * as SCHEMA from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

import { dbUpsertResource } from "./resource-db-upsert.js";
import { upsertReleaseTargets } from "./upsert-release-targets.js";

type ResourceToInsert = SCHEMA.InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const handleNewResource = async (db: Tx, resource: ResourceToInsert) => {
  const newResource = await dbUpsertResource(db, resource);
  const releaseTargets = await upsertReleaseTargets(db, newResource);
  await getQueue(Channel.EvaluateReleaseTarget).addBulk(
    releaseTargets.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
    })),
  );
};
