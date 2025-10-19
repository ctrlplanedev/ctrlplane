import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatusOapi } from "@ctrlplane/validators/jobs";

import type { GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
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

const convertJobToNodeEvent = (
  previous: schema.Job,
  current: schema.Job,
  workspaceId: string,
  eventType: Event,
) => ({
  workspaceId,
  eventType,
  eventId: current.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: { previous, current },
});

export const getOapiJob = async (
  job: schema.Job,
): Promise<WorkspaceEngine["schemas"]["Job"]> => {
  const release = await db
    .select()
    .from(schema.releaseJob)
    .where(eq(schema.releaseJob.jobId, job.id))
    .then(takeFirst);

  const { releaseId } = release;

  const metadata = await db
    .select()
    .from(schema.jobMetadata)
    .where(eq(schema.jobMetadata.jobId, job.id))
    .then((rows) =>
      Object.fromEntries(rows.map(({ key, value }) => [key, value])),
    );

  return {
    id: job.id,
    releaseId,
    jobAgentId: job.jobAgentId ?? "",
    jobAgentConfig: job.jobAgentConfig,
    externalId: job.externalId ?? undefined,
    status: JobStatusOapi[job.status],
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    metadata,
  };
};

const convertJobToGoEvent = async (
  job: schema.Job,
  workspaceId: string,
  eventType: keyof GoEventPayload,
): Promise<GoMessage<keyof GoEventPayload>> => ({
  workspaceId,
  eventType,
  data: {
    job: await getOapiJob(job),
    id: job.id,
  },
  timestamp: Date.now(),
});

export const dispatchJobUpdated = createSpanWrapper(
  "dispatchJobUpdated",
  async (span: Span, previous: schema.Job, current: schema.Job) => {
    span.setAttribute("job.id", current.id);
    span.setAttribute("job.status", current.status);

    const workspaceId = await getWorkspaceId(current);
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.JobUpdated;
    const nodeEvent = convertJobToNodeEvent(
      previous,
      current,
      workspaceId,
      eventType,
    );
    const goEvent = await convertJobToGoEvent(
      current,
      workspaceId,
      eventType as keyof GoEventPayload,
    );
    await sendNodeEvent(nodeEvent);
    await sendGoEvent(goEvent);
  },
);
