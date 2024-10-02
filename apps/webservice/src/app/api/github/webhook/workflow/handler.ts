import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
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
  const { id, status: externalStatus, conclusion } = event.workflow_run;

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

  if (job.status === JobStatus.Completed) return onJobCompletion(job);
};
