import type { HookEvent } from "@ctrlplane/validators/events";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import { isPresent } from "ts-is-present";

import { eq, isNotNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { TargetFilterType } from "@ctrlplane/validators/targets";

export const getEventsForDeploymentDeleted = async (
  deployment: SCHEMA.Deployment,
): Promise<HookEvent[]> => {
  const system = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, deployment.systemId),
    with: {
      environments: { where: isNotNull(SCHEMA.environment.targetFilter) },
    },
  });
  if (system == null) return [];

  const envFilters = system.environments
    .map((e) => e.targetFilter)
    .filter(isPresent);
  if (envFilters.length === 0) return [];

  const systemFilter: TargetCondition = {
    type: TargetFilterType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: envFilters,
  };

  const targets = await db.query.target.findMany({
    where: SCHEMA.targetMatchesMetadata(db, systemFilter),
  });

  return targets.map((target) => ({
    action: "deployment.target.removed",
    payload: { deployment, target },
  }));
};
