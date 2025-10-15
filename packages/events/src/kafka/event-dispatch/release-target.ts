import type { Span } from "@ctrlplane/logger";
import { isPresent } from "ts-is-present";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { createSpanWrapper } from "../../span.js";
import { sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getFullReleaseTarget = async (releaseTargetId: string) => {
  const dbResult = await db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .leftJoin(
      schema.resourceMetadata,
      eq(schema.resource.id, schema.resourceMetadata.resourceId),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.releaseTarget.id, releaseTargetId));

  const [first] = dbResult;
  if (first == null) throw new Error("Release target not found");

  const { release_target, resource, environment, deployment } = first;
  const resourceMetadata = Object.fromEntries(
    dbResult
      .map((r) => r.resource_metadata)
      .filter(isPresent)
      .map((m) => [m.key, m.value]),
  );

  return {
    ...release_target,
    resource: { ...resource, metadata: resourceMetadata },
    environment,
    deployment,
  };
};

export const dispatchEvaluateReleaseTarget = createSpanWrapper(
  "dispatchEvaluateReleaseTarget",
  async (
    span: Span,
    releaseTarget: schema.ReleaseTarget,
    opts?: { skipDuplicateCheck?: boolean },
    source?: "api" | "scheduler" | "user-action",
  ) => {
    span.setAttribute("releaseTarget.id", releaseTarget.id);
    span.setAttribute("deployment.id", releaseTarget.deploymentId);
    span.setAttribute("environment.id", releaseTarget.environmentId);

    const fullReleaseTarget = await getFullReleaseTarget(releaseTarget.id);
    span.setAttribute("workspace.id", fullReleaseTarget.resource.workspaceId);

    await sendNodeEvent({
      workspaceId: fullReleaseTarget.resource.workspaceId,
      eventType: Event.EvaluateReleaseTarget,
      eventId: fullReleaseTarget.id,
      timestamp: Date.now(),
      source: source ?? "api",
      payload: { releaseTarget: fullReleaseTarget, opts },
    });
  },
);
