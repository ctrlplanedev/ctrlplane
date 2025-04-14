import type { Tx } from "@ctrlplane/db";
import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import { trace } from "@opentelemetry/api";
import { isPresent } from "ts-is-present";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { makeWithSpan } from "./spans.js";

const tracer = trace.getTracer("upsert-release-targets");
const withSpan = makeWithSpan(tracer);

export const upsertReleaseTargets = withSpan(
  "upsertReleaseTargets",
  async (span, db: Tx, resource: SCHEMA.Resource) => {
    span.setAttribute("resource.id", resource.id);
    span.setAttribute("resource.name", resource.name);
    span.setAttribute("workspace.id", resource.workspaceId);

    const rows = await db
      .select()
      .from(SCHEMA.environmentSelectorComputedResource)
      .innerJoin(
        SCHEMA.environment,
        eq(
          SCHEMA.environmentSelectorComputedResource.environmentId,
          SCHEMA.environment.id,
        ),
      )
      .innerJoin(
        SCHEMA.deployment,
        eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
      )
      .leftJoin(
        SCHEMA.deploymentSelectorComputedResource,
        and(
          eq(
            SCHEMA.deploymentSelectorComputedResource.deploymentId,
            SCHEMA.deployment.id,
          ),
          eq(SCHEMA.deploymentSelectorComputedResource.resourceId, resource.id),
        ),
      )
      .where(
        eq(SCHEMA.environmentSelectorComputedResource.resourceId, resource.id),
      );

    const targets = rows
      .filter(
        (r) =>
          r.deployment.resourceSelector == null ||
          r.deployment_selector_computed_resource != null,
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
  },
);
