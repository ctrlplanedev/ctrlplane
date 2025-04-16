import type { Tx } from "@ctrlplane/db";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { makeWithSpan, trace } from "@ctrlplane/logger";

const tracer = trace.getTracer("upsert-release-targets");
const withSpan = makeWithSpan(tracer);

export const replaceReleaseTargets = withSpan(
  "replaceReleaseTargets",
  async (span, db: Tx, resource: SCHEMA.Resource) => {
    span.setAttribute("resource.id", resource.id);
    span.setAttribute("resource.name", resource.name);
    span.setAttribute("workspace.id", resource.workspaceId);

    return db.transaction(async (db) => {
      await db
        .delete(SCHEMA.releaseTarget)
        .where(eq(SCHEMA.releaseTarget.resourceId, resource.id));

      const rows = await db
        .select()
        .from(SCHEMA.computedEnvironmentResource)
        .innerJoin(
          SCHEMA.environment,
          eq(
            SCHEMA.computedEnvironmentResource.environmentId,
            SCHEMA.environment.id,
          ),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
        )
        .leftJoin(
          SCHEMA.computedDeploymentResource,
          and(
            eq(
              SCHEMA.computedDeploymentResource.deploymentId,
              SCHEMA.deployment.id,
            ),
            eq(SCHEMA.computedDeploymentResource.resourceId, resource.id),
          ),
        )
        .where(eq(SCHEMA.computedEnvironmentResource.resourceId, resource.id));

      const targets = rows
        .filter(
          (r) =>
            r.deployment.resourceSelector == null ||
            r.computed_deployment_resource != null,
        )
        .map((r) => ({
          environmentId: r.environment.id,
          deploymentId: r.deployment.id,
          resourceId: resource.id,
        }));

      if (targets.length === 0) return [];
      return db
        .insert(SCHEMA.releaseTarget)
        .values(targets)
        .onConflictDoNothing()
        .returning();
    });
  },
);
