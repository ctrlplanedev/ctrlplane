import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
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

  const job = await getJob(id, name);
  if (job == null)
    throw new Error(`Job not found: externalId=${id} name=${name}`);

  const updatedAt = new Date(updated_at);
  // // safeguard against out of order events, if the job's updatedAt is after the webhook event
  // // this means a more recent event has already been processed, so just skip
  // if (isAfter(job.updatedAt, updatedAt)) {
  //   logger.warn(`Skipping out of order event for job ${job.id}`, {
  //     job,
  //     event,
  //   });
  //   return;
  // }

  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const startedAt = new Date(run_started_at);
  const isJobCompleted = exitedStatus.includes(status as JobStatus);

  // the workflow run object doesn't have an explicit completedAt field
  // but if the job is in an exited state, the updated_at field works as a proxy
  // since thats the last time the job was updated
  const completedAt = isJobCompleted ? updatedAt : null;

  const externalId = id.toString();
  const Run = `https://github.com/${repository.owner.login}/${repository.name}/actions/runs/${id}`;
  const Workflow = `${Run}/workflow`;
  await updateJob(
    job.id,
    { status, externalId, startedAt, completedAt, updatedAt },
    { [String(ReservedMetadataKey.Links)]: { Run, Workflow } } as any,
  );
};
