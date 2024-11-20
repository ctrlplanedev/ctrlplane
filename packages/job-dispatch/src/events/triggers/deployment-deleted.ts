import type { HookEvent } from "@ctrlplane/validators/events";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { eq, isNotNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

export const getEventsForDeploymentDeleted = async (
  deployment: SCHEMA.Deployment,
): Promise<HookEvent[]> => {
  const system = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, deployment.systemId),
    with: {
      environments: { where: isNotNull(SCHEMA.environment.resourceFilter) },
    },
  });
  if (system == null) return [];

  const envFilters = system.environments
    .map((e) => e.resourceFilter)
    .filter(isPresent);
  if (envFilters.length === 0) return [];

  const systemFilter: ResourceCondition = {
    type: ResourceFilterType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: envFilters,
  };

  const resources = await db.query.resource.findMany({
    where: SCHEMA.resourceMatchesMetadata(db, systemFilter),
  });

  return resources.map((resource) => ({
    action: "deployment.resource.removed",
    payload: { deployment, resource },
  }));
};
