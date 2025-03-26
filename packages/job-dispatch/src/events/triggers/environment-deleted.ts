import type { HookEvent } from "@ctrlplane/validators/events";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, isNull, ne } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

export const getEventsForEnvironmentDeleted = async (
  environment: SCHEMA.Environment,
): Promise<HookEvent[]> => {
  if (environment.resourceSelector == null) return [];
  const resources = await db
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        SCHEMA.resourceMatchesMetadata(db, environment.resourceSelector),
        isNull(SCHEMA.resource.deletedAt),
      ),
    );
  if (resources.length === 0) return [];

  const checks = and(
    isNotNull(SCHEMA.environment.resourceSelector),
    ne(SCHEMA.environment.id, environment.id),
  );
  const system = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, environment.systemId),
    with: { environments: { where: checks }, deployments: true },
  });
  if (system == null) return [];

  const envFilters = system.environments
    .map((e) => e.resourceSelector)
    .filter(isPresent);

  const removedFromSystemFilter: ResourceCondition = {
    type: ResourceConditionType.Comparison,
    operator: ComparisonOperator.Or,
    not: true,
    conditions: envFilters,
  };

  const removedFromSystemResources =
    envFilters.length > 0
      ? await db
          .select()
          .from(SCHEMA.resource)
          .where(
            and(
              SCHEMA.resourceMatchesMetadata(db, removedFromSystemFilter),
              isNull(SCHEMA.resource.deletedAt),
              inArray(
                SCHEMA.resource.id,
                resources.map((r) => r.id),
              ),
            ),
          )
      : resources;
  if (removedFromSystemResources.length === 0) return [];

  return system.deployments.flatMap((deployment) =>
    removedFromSystemResources.map((resource) => ({
      action: "deployment.resource.removed",
      payload: { deployment, resource },
    })),
  );
};
