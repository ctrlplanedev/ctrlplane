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

  const system = await db
    .select()
    .from(SCHEMA.system)
    .leftJoin(
      SCHEMA.environment,
      eq(SCHEMA.environment.systemId, SCHEMA.system.id),
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
    }));

  const deploymentLifecycleHooks = await db
    .select()
    .from(SCHEMA.deploymentLifecycleHook)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deploymentLifecycleHook.deploymentId, SCHEMA.deployment.id),
    )
    .where(eq(SCHEMA.deployment.systemId, system.system.id))
    .then((rows) => rows.map((r) => r.deployment_lifecycle_hook));

  if (deploymentLifecycleHooks.length === 0) return;

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

  console.log("removedFromSystemTargets", removedFromSystemTargets);
  console.log("deploymentLifecycleHooks", deploymentLifecycleHooks);

  if (removedFromSystemTargets.length === 0) return;

  const handleLifecycleHooksForTargets = removedFromSystemTargets.flatMap((t) =>
    deploymentLifecycleHooks.map((dlh) => {
      const values: Record<string, string> = {
        targetId: t.id,
        deploymentId: dlh.deploymentId,
        environmentId: env.id,
        systemId: system.system.id,
      };

      return dispatchRunbook(db, dlh.runbookId, values);
    }),
  );

  await Promise.all(handleLifecycleHooksForTargets);
};
