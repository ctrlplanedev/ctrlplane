import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
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
  await updateJob(
    job.id,
    { status, externalId },
    {
      [String(ReservedMetadataKey.Links)]:
        `https://github.com/${repository.owner.login}/${repository.name}/actions/runs/${id}`,
    },
  );
};
