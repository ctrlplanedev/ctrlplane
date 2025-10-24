import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { buildConflictUpdateColumns, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { updateJob } from "@ctrlplane/job-dispatch";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

type Conclusion = Exclude<WorkflowRunEvent["workflow_run"]["conclusion"], null>;
const convertConclusion = (conclusion: Conclusion): schema.JobStatus => {
  if (conclusion === "success") return JobStatus.Successful;
  if (conclusion === "action_required") return JobStatus.ActionRequired;
  if (conclusion === "cancelled") return JobStatus.Cancelled;
  if (conclusion === "neutral") return JobStatus.Skipped;
  if (conclusion === "skipped") return JobStatus.Skipped;
  return JobStatus.Failure;
};

const getAllWorkspaceIds = () =>
  db
    .select({ id: schema.workspace.id })
    .from(schema.workspace)
    .then((rows) => rows.map((row) => row.id));

const convertStatus = (
  status: WorkflowRunEvent["workflow_run"]["status"],
): schema.JobStatus =>
  status === "completed" ? JobStatus.Successful : JobStatus.InProgress;

const extractUuid = (str: string) => {
  const uuidRegex =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/;
  const match = uuidRegex.exec(str);
  return match ? match[0] : null;
};

const getJob = async (externalId: number, name: string) => {
  const jobFromExternalId = await db
    .select()
    .from(schema.job)
    .where(eq(schema.job.externalId, externalId.toString()))
    .then(takeFirstOrNull);

  if (jobFromExternalId != null) return jobFromExternalId;

  const uuid = extractUuid(name);
  if (uuid == null) return null;

  return db
    .select()
    .from(schema.job)
    .where(eq(schema.job.id, uuid))
    .then(takeFirstOrNull);
};

const updateJobInDb = async (jobId: string, data: schema.UpdateJob) =>
  db.update(schema.job).set(data).where(eq(schema.job.id, jobId));

const updateLinks = async (jobId: string, links: Record<string, string>) =>
  db
    .insert(schema.jobMetadata)
    .values({
      jobId,
      key: String(ReservedMetadataKey.Links),
      value: JSON.stringify(links),
    })
    .onConflictDoUpdate({
      target: [schema.jobMetadata.jobId, schema.jobMetadata.key],
      set: buildConflictUpdateColumns(schema.jobMetadata, ["value"]),
    });

const convertStatusToOapiStatus = (
  status: JobStatus,
): WorkspaceEngine["schemas"]["JobStatus"] => {
  switch (status) {
    case JobStatus.Successful:
      return "successful";
    case JobStatus.Cancelled:
      return "cancelled";
    case JobStatus.Skipped:
      return "skipped";
    case JobStatus.Pending:
      return "pending";
    case JobStatus.InProgress:
      return "inProgress";
    case JobStatus.ActionRequired:
      return "actionRequired";
    case JobStatus.InvalidJobAgent:
      return "invalidJobAgent";
    case JobStatus.InvalidIntegration:
      return "invalidIntegration";
    case JobStatus.ExternalRunNotFound:
      return "externalRunNotFound";
    case JobStatus.Failure:
      return "failure";
  }
};

export const handleWorkflowWebhookEvent = async (event: WorkflowRunEvent) => {
  const {
    id,
    status: externalStatus,
    conclusion,
    repository,
    name,
    run_started_at,
    updated_at,
  } = event.workflow_run;

  const jobId = extractUuid(name);

  const updatedAt = new Date(updated_at);
  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const startedAt = new Date(run_started_at);
  const isJobCompleted = exitedStatus.includes(status as JobStatus);
  const completedAt = isJobCompleted ? updatedAt : null;

  const externalId = id.toString();
  const Run = `https://github.com/${repository.owner.login}/${repository.name}/actions/runs/${id}`;
  const Workflow = `${Run}/workflow`;
  const links = { Run, Workflow };
  const linksStr = JSON.stringify(links);
  const metadata = { [String(ReservedMetadataKey.Links)]: linksStr } as Record<
    string,
    string
  >;

  if (jobId != null) {
    const workspaceIds = await getAllWorkspaceIds();
    const jobUpdateEvent: WorkspaceEngine["schemas"]["JobUpdateEvent"] = {
      job: {
        id: jobId,
        externalId,
        createdAt: startedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        completedAt: completedAt?.toISOString() ?? undefined,
        startedAt: startedAt.toISOString(),
        status: convertStatusToOapiStatus(status as JobStatus),
        releaseId: "",
        jobAgentConfig: {},
        jobAgentId: "",
        metadata,
      },
      fieldsToUpdate: [
        "externalId",
        "updatedAt",
        "completedAt",
        "startedAt",
        "status",
        "metadata",
      ],
    };

    for (const workspaceId of workspaceIds) {
      await sendGoEvent({
        workspaceId,
        eventType: Event.JobUpdated,
        data: jobUpdateEvent,
        timestamp: Date.now(),
      });
    }
  }

  const job = await getJob(id, name);
  if (job == null)
    throw new Error(`Job not found: externalId=${id} name=${name}`);

  const updates = { status, externalId, startedAt, completedAt, updatedAt };
  await updateJobInDb(job.id, updates);

  await updateLinks(job.id, links);
  await updateJob(job.id, updates, metadata);
};
