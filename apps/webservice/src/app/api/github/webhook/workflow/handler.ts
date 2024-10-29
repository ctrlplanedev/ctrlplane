import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { onJobCompletion } from "@ctrlplane/job-dispatch";
import { JobStatus } from "@ctrlplane/validators/jobs";

type Conclusion = Exclude<WorkflowRunEvent["workflow_run"]["conclusion"], null>;
const convertConclusion = (conclusion: Conclusion): schema.JobStatus => {
  if (conclusion === "success") return "completed";
  if (conclusion === "action_required") return "action_required";
  if (conclusion === "cancelled") return "cancelled";
  if (conclusion === "neutral") return "skipped";
  if (conclusion === "skipped") return "skipped";
  return "failure";
};

const convertStatus = (
  status: WorkflowRunEvent["workflow_run"]["status"],
): schema.JobStatus =>
  status === JobStatus.Completed ? JobStatus.Completed : JobStatus.InProgress;

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
  } = event.workflow_run;

  const job = await getJob(id, name);
  if (job == null) return;

  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const externalId = id.toString();
  await db
    .update(schema.job)
    .set({ status, externalId })
    .where(eq(schema.job.id, job.id));

  const existingUrlMetadata = await db
    .select()
    .from(schema.jobMetadata)
    .where(
      and(
        eq(schema.jobMetadata.jobId, job.id),
        eq(schema.jobMetadata.key, "ctrlplane/links"),
      ),
    )
    .then(takeFirstOrNull);

  const links = JSON.stringify({
    ...JSON.parse(existingUrlMetadata?.value ?? "{}"),
    GitHub: `https://github.com/${repository.owner.login}/${repository.name}/actions/runs/${id}`,
  });

  await db
    .insert(schema.jobMetadata)
    .values([{ jobId: job.id, key: "ctrlplane/links", value: links }])
    .onConflictDoUpdate({
      target: [schema.jobMetadata.jobId, schema.jobMetadata.key],
      set: { value: links },
    });

  if (job.status === JobStatus.Completed) return onJobCompletion(job);
};
