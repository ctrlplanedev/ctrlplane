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

export const handleWorkflowWebhookEvent = async (event: WorkflowRunEvent) => {
  const {
    id,
    status: externalStatus,
    conclusion,
    repository,
  } = event.workflow_run;

  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const job = await db
    .update(schema.job)
    .set({ status })
    .where(eq(schema.job.externalId, id.toString()))
    .returning()
    .then(takeFirstOrNull);

  // Addressing a race condition: When the job is created externally on GitHub,
  // it triggers a webhook event. However, our system hasn't updated the job with
  // the externalRunId yet, as it depends on the job's instantiation. Therefore,
  // the first event lacks the run ID, so we skip it and wait for the next event.
  if (job == null) return;

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
