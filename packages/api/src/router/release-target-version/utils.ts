import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

export type ReleaseTarget = schema.ReleaseTarget & {
  resource: schema.Resource;
  environment: schema.Environment;
  deployment: schema.Deployment;
};

export const getReleaseTarget = (
  releaseTargetId: string,
): Promise<ReleaseTarget> =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst)
    .then((row) => ({
      ...row.release_target,
      resource: row.resource,
      environment: row.environment,
      deployment: row.deployment,
    }));
