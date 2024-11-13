import type { HookEvent } from "@ctrlplane/validators/events";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import { isPresent } from "ts-is-present";

import { eq, isNotNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { TargetFilterType } from "@ctrlplane/validators/targets";

/**
 * Get events for a target that has been deleted.
 * NOTE: Because we may need to do inner joins on target metadata for the filter,
 * this actually needs to be called before the target is actually deleted.
 * @param target
 */
export const getEventsForTargetDeleted = async (
  target: SCHEMA.Resource,
): Promise<HookEvent[]> => {
  const systems = await db.query.system.findMany({
    where: eq(SCHEMA.system.workspaceId, target.workspaceId),
    with: {
      environments: { where: isNotNull(SCHEMA.environment.resourceFilter) },
      deployments: true,
    },
  });

  const deploymentPromises = systems.map(async (s) => {
    const filters = s.environments
      .map((e) => e.resourceFilter)
      .filter(isPresent);

    const systemFilter: TargetCondition = {
      type: TargetFilterType.Comparison,
      operator: ComparisonOperator.Or,
      conditions: filters,
    };

    const matchedTarget = await db.query.resource.findFirst({
      where: SCHEMA.resourceMatchesMetadata(db, systemFilter),
    });
    if (matchedTarget == null) return [];

    return s.deployments;
  });
  const deployments = (await Promise.all(deploymentPromises)).flat();

  return deployments.map((deployment) => ({
    action: "deployment.target.removed",
    payload: { target, deployment },
  }));
};
