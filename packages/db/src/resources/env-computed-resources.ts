import { and, eq } from "drizzle-orm";

import { Tx } from "../common";
import * as SCHEMA from "../schema/index.js";

export const computeEnvironmentSelectorResources = async (
  db: Tx,
  environmentId: string,
) => {
  const environment = await db.query.environment.findFirst({
    where: eq(SCHEMA.environment.id, environmentId),
    with: { system: true },
  });
  if (environment == null)
    throw new Error(`Environment not found: ${environmentId}`);

  const { system } = environment;
  const { workspaceId } = system;

  await db
    .delete(SCHEMA.environmentSelectorComputedResource)
    .where(
      eq(
        SCHEMA.environmentSelectorComputedResource.environmentId,
        environmentId,
      ),
    );

  if (environment.resourceSelector == null) return;

  await db
    .insert(SCHEMA.environmentSelectorComputedResource)
    .select(
      db
        .select({
          environmentId: SCHEMA.environment.id,
          resourceId: SCHEMA.resource.id,
        })
        .from(SCHEMA.resource)
        .innerJoin(SCHEMA.environment, eq(SCHEMA.environment.id, environmentId))
        .where(
          and(
            eq(SCHEMA.resource.workspaceId, workspaceId),
            SCHEMA.resourceMatchesMetadata(db, environment.resourceSelector),
          ),
        ),
    )
    .onConflictDoNothing();
};
