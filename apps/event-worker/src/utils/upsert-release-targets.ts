import type { Tx } from "@ctrlplane/db";
import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import { trace } from "@opentelemetry/api";
import { isPresent } from "ts-is-present";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { makeWithSpan } from "./spans.js";

const tracer = trace.getTracer("upsert-release-targets");
const withSpan = makeWithSpan(tracer);

const getReleaseTargetInsertsForSystem = withSpan(
  "getReleaseTargetInsertsForSystem",
  async (
    span,
    db: Tx,
    resourceId: string,
    system: SCHEMA.System & {
      environments: SCHEMA.Environment[];
      deployments: SCHEMA.Deployment[];
    },
  ): Promise<ReleaseTargetIdentifier[]> => {
    span.setAttribute("resource.id", resourceId);
    span.setAttribute("system.id", system.id);
    span.setAttribute("system.name", system.name);

    const envs = system.environments.filter((e) =>
      isPresent(e.resourceSelector),
    );
    const { deployments } = system;

    const maybeTargetsPromises = envs.flatMap((env) =>
      deployments.map(async (dep) => {
        const resource = await db.query.resource.findFirst({
          where: and(
            eq(SCHEMA.resource.id, resourceId),
            SCHEMA.resourceMatchesMetadata(db, env.resourceSelector),
            SCHEMA.resourceMatchesMetadata(db, dep.resourceSelector),
          ),
        });

        if (resource == null) return null;
        return { environmentId: env.id, deploymentId: dep.id };
      }),
    );

    const targets = await Promise.all(maybeTargetsPromises).then((results) =>
      results.filter(isPresent),
    );

    return targets.map((t) => ({ ...t, resourceId }));
  },
);

export const upsertReleaseTargets = withSpan(
  "upsertReleaseTargets",
  async (span, db: Tx, resource: SCHEMA.Resource) => {
    span.setAttribute("resource.id", resource.id);
    span.setAttribute("resource.name", resource.name);
    span.setAttribute("workspace.id", resource.workspaceId);

    const workspace = await db.query.workspace.findFirst({
      where: eq(SCHEMA.workspace.id, resource.workspaceId),
      with: { systems: { with: { environments: true, deployments: true } } },
    });
    if (workspace == null) throw new Error("Workspace not found");

    const releaseTargetInserts = await Promise.all(
      workspace.systems.map((system) =>
        getReleaseTargetInsertsForSystem(db, resource.id, system),
      ),
    ).then((results) => results.flat());

    if (releaseTargetInserts.length === 0) return [];
    return db
      .insert(SCHEMA.releaseTarget)
      .values(releaseTargetInserts)
      .onConflictDoNothing()
      .returning();
  },
);
