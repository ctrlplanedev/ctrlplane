import type { Tx } from "@ctrlplane/db";
import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";

import { and, eq, inArray, isNotNull, notInArray, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { HookAction } from "@ctrlplane/validators/events";

import { dbUpsertResource } from "./resource-db-upsert.js";
import { upsertReleaseTargets } from "./upsert-release-targets.js";

type ResourceToInsert = SCHEMA.InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

const getSystemsForUnmatchedEnvs = async (
  db: Tx,
  previousReleaseTargets: ReleaseTargetIdentifier[],
  newReleaseTargets: ReleaseTargetIdentifier[],
) => {
  const previousEnvIds = new Set<string>(
    previousReleaseTargets.map((rt) => rt.environmentId),
  );
  const newEnvIds = new Set<string>(
    newReleaseTargets.map((rt) => rt.environmentId),
  );
  const unmatchedEnvs = Array.from(previousEnvIds).filter(
    (envId) => !newEnvIds.has(envId),
  );

  const envs = await db.query.environment.findMany({
    where: inArray(SCHEMA.environment.id, unmatchedEnvs),
  });

  return db.query.system.findMany({
    where: inArray(
      SCHEMA.system.id,
      envs.map((e) => e.systemId),
    ),
    with: {
      deployments: true,
      environments: {
        where: and(
          isNotNull(SCHEMA.environment.resourceSelector),
          notInArray(SCHEMA.environment.id, unmatchedEnvs),
        ),
      },
    },
  });
};

const dispatchExitHooksIfExitedSystem = async (
  db: Tx,
  resource: SCHEMA.Resource,
  system: {
    deployments: SCHEMA.Deployment[];
    environments: SCHEMA.Environment[];
  },
) => {
  const { deployments, environments } = system;
  const matchedResource = await db.query.resource.findFirst({
    where: and(
      eq(SCHEMA.resource.id, resource.id),
      or(
        ...environments.map((e) =>
          SCHEMA.resourceMatchesMetadata(db, e.resourceSelector),
        ),
      ),
    ),
  });
  if (matchedResource == null) return;

  const events = deployments.map((deployment) => ({
    action: HookAction.DeploymentResourceRemoved,
    payload: { deployment, resource },
  }));

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

export const handleExistingResource = async (
  db: Tx,
  existingResource: SCHEMA.Resource,
  updates: ResourceToInsert,
) => {
  const currentReleaseTargets = await db.query.releaseTarget.findMany({
    where: eq(SCHEMA.releaseTarget.resourceId, existingResource.id),
  });

  const updatedResource = await dbUpsertResource(db, updates);
  const newReleaseTargets = await upsertReleaseTargets(db, updatedResource);
  const releaseTargetsToDelete = currentReleaseTargets.filter(
    (rt) => !newReleaseTargets.includes(rt),
  );

  await db
    .delete(SCHEMA.releaseTarget)
    .where(
      inArray(
        SCHEMA.releaseTarget.id,
        releaseTargetsToDelete.map((rt) => rt.id),
      ),
    )
    .returning();

  const systems = await getSystemsForUnmatchedEnvs(
    db,
    currentReleaseTargets,
    newReleaseTargets,
  );

  const dispatchExitHooksPromises = systems.map((system) =>
    dispatchExitHooksIfExitedSystem(db, updatedResource, system),
  );

  const addToEvaluateQueuePromise = getQueue(
    Channel.EvaluateReleaseTarget,
  ).addBulk(
    releaseTargetsToDelete.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
    })),
  );

  await Promise.allSettled([
    ...dispatchExitHooksPromises,
    addToEvaluateQueuePromise,
  ]);
};
