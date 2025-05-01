import type { HookEvent } from "@ctrlplane/validators/events";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { and, eq, isNotNull, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { HookAction } from "@ctrlplane/validators/events";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

export const getEventsForDeploymentRemoved = async (
  deployment: SCHEMA.Deployment,
  systemId: string,
): Promise<HookEvent[]> => {
  const hasFilter = isNotNull(SCHEMA.environment.resourceSelector);
  const system = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, systemId),
    with: { environments: { where: hasFilter } },
  });
  if (system == null) return [];

  const envFilters = system.environments
    .map((e) => e.resourceSelector)
    .filter(isPresent);
  if (envFilters.length === 0) return [];

  const systemFilter: ResourceCondition = {
    type: ResourceConditionType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: envFilters,
  };

  const resources = await db.query.resource.findMany({
    where: and(
      SCHEMA.resourceMatchesMetadata(db, systemFilter),
      isNull(SCHEMA.resource.deletedAt),
    ),
  });

  return resources.map((resource) => ({
    action: HookAction.DeploymentResourceRemoved,
    payload: { deployment, resource },
  }));
};
