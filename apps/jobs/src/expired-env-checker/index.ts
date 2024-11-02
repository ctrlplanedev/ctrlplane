import _ from "lodash";

import { eq, inArray, lte } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { handleTargetsFromEnvironmentToBeDeleted } from "@ctrlplane/job-dispatch";

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
  const expiredEnvironments = await db
    .select()
    .from(SCHEMA.environment)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
    )
    .where(lte(SCHEMA.environment.expiresAt, new Date()))
    .then(groupByEnvironment);
  if (expiredEnvironments.length === 0) return;

  await Promise.all(
    expiredEnvironments.map((env) =>
      handleTargetsFromEnvironmentToBeDeleted(db, env),
    ),
  );

  const envIds = expiredEnvironments.map((env) => env.id);
  await db
    .delete(SCHEMA.environment)
    .where(inArray(SCHEMA.environment.id, envIds));
};
