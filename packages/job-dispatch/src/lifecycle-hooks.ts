import type { Tx } from "@ctrlplane/db";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, ne } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { TargetFilterType } from "@ctrlplane/validators/targets";

import { dispatchRunbook } from "./job-dispatch.js";

export const handleTargetsFromEnvironmentToBeDeleted = async (
  db: Tx,
  env: SCHEMA.Environment,
) => {
  if (env.targetFilter == null) return;

  const targets = await db
    .select()
    .from(SCHEMA.target)
    .where(SCHEMA.targetMatchesMetadata(db, env.targetFilter));

  if (targets.length === 0) return;

  const deploymentLifecycleHooksSubquery = db
    .select()
    .from(SCHEMA.deployment)
    .innerJoin(
      SCHEMA.deploymentLifecycleHook,
      eq(SCHEMA.deployment.id, SCHEMA.deploymentLifecycleHook.deploymentId),
    )
    .innerJoin(
      SCHEMA.runbook,
      eq(SCHEMA.deploymentLifecycleHook.runbookId, SCHEMA.runbook.id),
    )
    .as("deploymentLifecycleHooksSubquery");

  const system = await db
    .select()
    .from(SCHEMA.system)
    .leftJoin(
      SCHEMA.environment,
      eq(SCHEMA.environment.systemId, SCHEMA.system.id),
    )
    .leftJoin(
      deploymentLifecycleHooksSubquery,
      eq(
        SCHEMA.environment.systemId,
        deploymentLifecycleHooksSubquery.deployment.systemId,
      ),
    )
    .where(
      and(
        eq(SCHEMA.system.id, env.systemId),
        isNotNull(SCHEMA.environment.targetFilter),
        ne(SCHEMA.environment.id, env.id),
      ),
    )
    .then((rows) => ({
      ...rows[0]!,
      environments: rows.map((r) => r.environment).filter(isPresent),
      deploymentLifecycleHooks: rows
        .map((r) => r.deploymentLifecycleHooksSubquery)
        .filter(isPresent),
    }));

  if (system.deploymentLifecycleHooks.length === 0) return;

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

  const handleLifecycleHooksForTargets = removedFromSystemTargets.flatMap(
    (t) => {
      return system.deploymentLifecycleHooks.map((dlh) => {
        const values: Record<string, string> = {
          targetId: t.id,
          deploymentId: dlh.deployment.id,
          environmentId: env.id,
          systemId: system.system.id,
        };

        return dispatchRunbook(db, dlh.runbook.id, values);
      });
    },
  );

  await Promise.all(handleLifecycleHooksForTargets);
};
