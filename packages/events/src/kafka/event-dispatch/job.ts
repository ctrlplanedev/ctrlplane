import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getWorkspaceId = async (job: schema.Job) => {
  const releaseJobWsIDResult = await db
    .select()
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.job.id, job.id))
    .then(takeFirstOrNull)
    .then((row) => row?.resource.workspaceId);

  if (releaseJobWsIDResult != null) return releaseJobWsIDResult;

  const runbookJobWsIDResult = await db
    .select()
    .from(schema.job)
    .innerJoin(
      schema.runbookJobTrigger,
      eq(schema.runbookJobTrigger.jobId, schema.job.id),
    )
    .innerJoin(
      schema.runbook,
      eq(schema.runbookJobTrigger.runbookId, schema.runbook.id),
    )
    .innerJoin(schema.system, eq(schema.runbook.systemId, schema.system.id))
    .where(eq(schema.job.id, job.id))
    .then(takeFirstOrNull)
    .then((row) => row?.system.workspaceId);

  if (runbookJobWsIDResult != null) return runbookJobWsIDResult;

  throw new Error("Job not found");
};

export const dispatchJobUpdated = async (
  previous: schema.Job,
  current: schema.Job,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceId(current);
  await sendNodeEvent({
    workspaceId,
    eventType: Event.JobUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
};
