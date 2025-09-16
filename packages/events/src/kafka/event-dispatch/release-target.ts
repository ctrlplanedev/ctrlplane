import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendEvent } from "../client.js";
import { Event } from "../events.js";

const getWorkspaceId = async (releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst)
    .then((row) => row.resource.workspaceId);

export const dispatchEvaluateReleaseTarget = async (
  releaseTarget: schema.ReleaseTarget,
  opts?: { skipDuplicateCheck?: boolean },
  source?: "api" | "scheduler" | "user-action",
) =>
  getWorkspaceId(releaseTarget.id).then((workspaceId) =>
    sendEvent({
      workspaceId,
      eventType: Event.EvaluateReleaseTarget,
      eventId: releaseTarget.id,
      timestamp: Date.now(),
      source: source ?? "api",
      payload: { releaseTarget, opts },
    }),
  );
