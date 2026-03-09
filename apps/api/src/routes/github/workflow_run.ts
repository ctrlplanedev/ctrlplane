import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { enqueueDesiredRelease } from "@ctrlplane/db/reconcilers";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

const extractUuid = (str: string) => {
  const uuidRegex =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/;
  const match = uuidRegex.exec(str);
  return match ? match[0] : null;
};

type Conclusion = Exclude<WorkflowRunEvent["workflow_run"]["conclusion"], null>;
const convertConclusion = (conclusion: Conclusion): JobStatus => {
  if (conclusion === "success") return JobStatus.Successful;
  if (conclusion === "action_required") return JobStatus.ActionRequired;
  if (conclusion === "cancelled") return JobStatus.Cancelled;
  if (conclusion === "neutral") return JobStatus.Skipped;
  if (conclusion === "skipped") return JobStatus.Skipped;
  return JobStatus.Failure;
};

const convertStatus = (
  status: WorkflowRunEvent["workflow_run"]["status"],
): JobStatus =>
  status === "completed" ? JobStatus.Successful : JobStatus.InProgress;

export const handleWorkflowRunEvent = async (event: WorkflowRunEvent) => {
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
  if (jobId == null) return;

  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const startedAt = new Date(run_started_at);
  const updatedAt = new Date(updated_at);
  const isCompleted = exitedStatus.includes(status);
  const completedAt = isCompleted ? updatedAt : null;
  const externalId = id.toString();

  const [updated] = await db
    .update(schema.job)
    .set({
      externalId,
      status,
      startedAt,
      completedAt,
      updatedAt,
    })
    .where(eq(schema.job.id, jobId))
    .returning();

  if (updated == null) return;

  const Run = `https://github.com/${repository.owner.login}/${repository.name}/actions/runs/${id}`;
  const Workflow = `${Run}/workflow`;
  const links = JSON.stringify({ Run, Workflow });

  const metadataEntries = [
    { jobId, key: String(ReservedMetadataKey.Links), value: links },
    { jobId, key: "run_url", value: Run },
  ];

  for (const entry of metadataEntries) {
    await db
      .insert(schema.jobMetadata)
      .values(entry)
      .onConflictDoUpdate({
        target: [schema.jobMetadata.key, schema.jobMetadata.jobId],
        set: { value: entry.value },
      });
  }

  const releaseTarget = await db
    .select({
      deploymentId: schema.release.deploymentId,
      environmentId: schema.release.environmentId,
      resourceId: schema.release.resourceId,
      workspaceId: schema.deployment.workspaceId,
    })
    .from(schema.releaseJob)
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirstOrNull);

  if (releaseTarget?.workspaceId != null)
    await enqueueDesiredRelease(db, {
      workspaceId: releaseTarget.workspaceId,
      deploymentId: releaseTarget.deploymentId,
      environmentId: releaseTarget.environmentId,
      resourceId: releaseTarget.resourceId,
    });
};
