import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { buildConflictUpdateColumns, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

const log = logger.child({ module: "github-webhook" });

type Conclusion = Exclude<WorkflowRunEvent["workflow_run"]["conclusion"], null>;
const convertConclusion = (conclusion: Conclusion): schema.JobStatus => {
  if (conclusion === "success") return JobStatus.Successful;
  if (conclusion === "action_required") return JobStatus.ActionRequired;
  if (conclusion === "cancelled") return JobStatus.Cancelled;
  if (conclusion === "neutral") return JobStatus.Skipped;
  if (conclusion === "skipped") return JobStatus.Skipped;
  return JobStatus.Failure;
};

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

export const handleWorkflowWebhookEvent = async (event: WorkflowRunEvent) => {
  log.info("Handling github workflow run event", {
    externalId: event.workflow_run.id,
    event,
  });

  const {
    id,
    status: externalStatus,
    conclusion,
    repository,
    name,
    run_started_at,
    updated_at,
  } = event.workflow_run;

  const job = await getJob(id, name);
  if (job == null)
    throw new Error(`Job not found: externalId=${id} name=${name}`);

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
  const updates = { status, externalId, startedAt, completedAt, updatedAt };
  await updateJobInDb(job.id, updates);

  const links = { Run, Workflow };
  await updateLinks(job.id, links);
  const metadata = { [String(ReservedMetadataKey.Links)]: links };
  await updateJob(job.id, updates, metadata);
};
