import type { EnvironmentDeletedEvent } from "@ctrlplane/validators/events";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import { isPresent } from "ts-is-present";

import {
  and,
  eq,
  inArray,
  isNotNull,
  ne,
  or,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { dispatchRunbook } from "@ctrlplane/job-dispatch";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { TargetFilterType } from "@ctrlplane/validators/targets";

const handleTargets = async (event: EnvironmentDeletedEvent) => {
  const environment = await db
    .select()
    .from(SCHEMA.environment)
    .where(eq(SCHEMA.environment.id, event.payload.environmentId))
    .then(takeFirstOrNull);

  if (environment?.targetFilter == null) return;

  const targets = await db
    .select()
    .from(SCHEMA.target)
    .where(SCHEMA.targetMatchesMetadata(db, environment.targetFilter));
  if (targets.length === 0) return;

  const checks = and(
    isNotNull(SCHEMA.environment.targetFilter),
    ne(SCHEMA.environment.id, environment.id),
  );
  const system = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, environment.systemId),
    with: { environments: { where: checks }, deployments: true },
  });
  if (system == null) return;

  const envFilters = system.environments
    .map((e) => e.targetFilter)
    .filter(isPresent);

  const removedFromSystemFilter: TargetCondition = {
    type: TargetFilterType.Comparison,
    operator: ComparisonOperator.Or,
    not: true,
    conditions: envFilters,
  };

  const removedFromSystemTargets =
    envFilters.length > 0
      ? await db
          .select()
          .from(SCHEMA.target)
          .where(
            and(
              SCHEMA.targetMatchesMetadata(db, removedFromSystemFilter),
              inArray(
                SCHEMA.target.id,
                targets.map((t) => t.id),
              ),
            ),
          )
      : targets;
  if (removedFromSystemTargets.length === 0) return;

  const runhooks = await db
    .select()
    .from(SCHEMA.runhook)
    .innerJoin(
      SCHEMA.runhookEvent,
      eq(SCHEMA.runhookEvent.runhookId, SCHEMA.runhook.id),
    )
    .where(
      or(
        ...system.deployments.map((deployment) =>
          and(
            eq(SCHEMA.runhook.scopeType, "deployment"),
            eq(SCHEMA.runhook.scopeId, deployment.id),
            eq(SCHEMA.runhookEvent.eventType, "environment.deleted"),
          ),
        ),
      ),
    )
    .then((r) => r.map((rh) => rh.runhook));
  if (runhooks.length === 0) return;

  const handleLifecycleHooksForTargets = removedFromSystemTargets.flatMap((t) =>
    runhooks.map((rh) => {
      const values: Record<string, string> = {
        targetId: t.id,
        deploymentId: rh.scopeId,
        environmentId: environment.id,
        systemId: system.id,
      };

      return dispatchRunbook(db, rh.runbookId, values);
    }),
  );

  await Promise.all(handleLifecycleHooksForTargets);
};

export const handleEnvironmentDeleted = (event: EnvironmentDeletedEvent) =>
  handleTargets(event);
