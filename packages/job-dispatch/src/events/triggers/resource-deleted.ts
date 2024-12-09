import type { HookEvent } from "@ctrlplane/validators/events";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { and, eq, isNotNull, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

/**
 * Get events for a resource that has been deleted.
 * @param resource
 */
export const getEventsForResourceDeleted = async (
  resource: SCHEMA.Resource,
): Promise<HookEvent[]> => {
  const systems = await db.query.system.findMany({
    where: eq(SCHEMA.system.workspaceId, resource.workspaceId),
    with: {
      environments: { where: isNotNull(SCHEMA.environment.resourceFilter) },
      deployments: true,
    },
  });

  const deploymentPromises = systems.map(async (s) => {
    const filters = s.environments
      .map((e) => e.resourceFilter)
      .filter(isPresent);

    const systemFilter: ResourceCondition = {
      type: ResourceFilterType.Comparison,
      operator: ComparisonOperator.Or,
      conditions: filters,
    };

    const matchedResource = await db.query.resource.findFirst({
      where: and(
        SCHEMA.resourceMatchesMetadata(db, systemFilter),
        isNull(SCHEMA.resource.deletedAt),
        eq(SCHEMA.resource.id, resource.id),
      ),
    });
    if (matchedResource == null) return [];

    return s.deployments;
  });
  const deployments = (await Promise.all(deploymentPromises)).flat();

  return deployments.map((deployment) => ({
    action: "deployment.resource.removed",
    payload: { resource, deployment },
  }));
};
