import type { Tx } from "@ctrlplane/db";
import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import { logger } from "@azure/identity";
import { isPresent } from "ts-is-present";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

const getReleaseTargetInsertsForSystem = async (
  db: Tx,
  resourceId: string,
  system: SCHEMA.System & {
    environments: SCHEMA.Environment[];
    deployments: SCHEMA.Deployment[];
  },
): Promise<ReleaseTargetIdentifier[]> => {
  const envs = system.environments.filter((e) => isPresent(e.resourceSelector));
  const { deployments } = system;

  const maybeTargetsPromises = envs.flatMap((env) =>
    deployments.map(async (dep) => {
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(SCHEMA.resource.id, resourceId),
          SCHEMA.resourceMatchesMetadata(db, env.resourceSelector),
          SCHEMA.resourceMatchesMetadata(db, dep.resourceSelector),
        ),
      });

      if (resource == null) return null;
      return { environmentId: env.id, deploymentId: dep.id };
    }),
  );

  const targets = await Promise.all(maybeTargetsPromises).then((results) =>
    results.filter(isPresent),
  );

  return targets.map((t) => ({ ...t, resourceId }));
};

export const upsertReleaseTargets = async (
  db: Tx,
  resource: SCHEMA.Resource,
) => {
  logger.info(`Upserting release targets for resource ${resource.id}`);

  const workspace = await db.query.workspace.findFirst({
    where: eq(SCHEMA.workspace.id, resource.workspaceId),
    with: { systems: { with: { environments: true, deployments: true } } },
  });
  if (workspace == null) throw new Error("Workspace not found");

  const releaseTargetInserts = await Promise.all(
    workspace.systems.map((system) =>
      getReleaseTargetInsertsForSystem(db, resource.id, system),
    ),
  ).then((results) => results.flat());

  if (releaseTargetInserts.length === 0) return [];
  return db
    .insert(SCHEMA.releaseTarget)
    .values(releaseTargetInserts)
    .onConflictDoNothing()
    .returning();
};
