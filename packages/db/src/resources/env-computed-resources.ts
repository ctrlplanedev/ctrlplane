import { and, eq, sql } from "drizzle-orm";

import { takeFirst, Tx } from "../common";
import * as SCHEMA from "../schema/index.js";

export const computeEnvironmentSelectorResources = async (
  db: Tx,
  environment: Pick<SCHEMA.Environment, "id" | "resourceSelector">,
) => {
  const { workspaceId } = await db
    .select({ workspaceId: SCHEMA.system.workspaceId })
    .from(SCHEMA.environment)
    .innerJoin(SCHEMA.system, eq(SCHEMA.environment.systemId, SCHEMA.system.id))
    .where(eq(SCHEMA.environment.id, environment.id))
    .then(takeFirst);

  await db
    .delete(SCHEMA.environmentSelectorComputedResource)
    .where(
      eq(
        SCHEMA.environmentSelectorComputedResource.environmentId,
        environment.id,
      ),
    );

  if (environment.resourceSelector == null) return;

  const resourceIds = await db
    .select({ resourceId: SCHEMA.resource.id })
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.workspaceId, workspaceId),
        SCHEMA.resourceMatchesMetadata(db, environment.resourceSelector),
      ),
    );

  const inserts = resourceIds.map((r) => ({
    environmentId: environment.id,
    resourceId: r.resourceId,
  }));

  await db
    .insert(SCHEMA.environmentSelectorComputedResource)
    .values(inserts)
    .onConflictDoNothing();
};
