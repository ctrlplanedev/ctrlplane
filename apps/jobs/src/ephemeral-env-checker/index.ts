import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, lte } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";

type QueryRow = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
};

const groupByEnvironment = (rows: QueryRow[]) =>
  _.chain(rows)
    .groupBy((e) => e.environment.id)
    .map((env) => ({
      ...env[0]!.environment,
      deployments: env.map((e) => e.deployment),
    }))
    .value();

export const run = async () => {
  const ephemeralEnvironments = await db
    .select()
    .from(SCHEMA.environment)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
    )
    .where(
      and(
        isNotNull(SCHEMA.environment.expiresAt),
        lte(SCHEMA.environment.expiresAt, new Date()),
      ),
    )
    .then(groupByEnvironment);
  if (ephemeralEnvironments.length === 0) return;

  const targetPromises = ephemeralEnvironments
    .filter((env) => isPresent(env.targetFilter))
    .map(async (env) => {
      const targets = await db
        .select()
        .from(SCHEMA.target)
        .where(SCHEMA.targetMatchesMetadata(db, env.targetFilter));

      return { environmentId: env.id, targets };
    });
  const associatedTargets = await Promise.all(targetPromises);

  for (const { environmentId, targets } of associatedTargets)
    console.log(
      `[${targets.length}] targets are associated with ephemeral environment [${environmentId}]`,
    );

  const envIds = ephemeralEnvironments.map((env) => env.id);
  await db
    .delete(SCHEMA.environment)
    .where(inArray(SCHEMA.environment.id, envIds));
};
