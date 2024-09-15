import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { onJobCompletion } from "@ctrlplane/job-dispatch";

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
): schema.JobStatus => {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  return "pending";
};

export const handleWorkflowWebhookEvent = async (event: WorkflowRunEvent) => {
  const { id, status: externalStatus, conclusion } = event.workflow_run;

  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const job = await db
    .update(schema.job)
    .set({ status })
    .where(eq(schema.job.externalRunId, id.toString()))
    .returning()
    .then(takeFirst);

  if (job.status === "completed") await onJobCompletion(job);
};
