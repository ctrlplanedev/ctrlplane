import type { Tx } from "@ctrlplane/db";
import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";

import { and, eq, inArray, isNotNull, notInArray, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { HookAction } from "@ctrlplane/validators/events";

import { withSpan } from "./span.js";

const getSystemsForUnmatchedEnvs = withSpan(
  "getSystemsForUnmatchedEnvs",
  async (
    _,
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
  },
);

const dispatchExitHooksIfExitedSystem = withSpan(
  "dispatchExitHooksIfExitedSystem",
  async (
    _,
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
  },
);

export const dispatchExitHooks = withSpan(
  "dispatchExitHooks",
  async (
    _,
    db: Tx,
    resource: SCHEMA.Resource,
    currentReleaseTargets: ReleaseTargetIdentifier[],
    newReleaseTargets: ReleaseTargetIdentifier[],
  ) => {
    const systems = await getSystemsForUnmatchedEnvs(
      db,
      currentReleaseTargets,
      newReleaseTargets,
    );
    const dispatchExitHooksPromises = systems.map((system) =>
      dispatchExitHooksIfExitedSystem(db, resource, system),
    );
    await Promise.allSettled(dispatchExitHooksPromises);
  },
);
