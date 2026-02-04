import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
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

const generateOapiEvent = (
  event: WorkflowRunEvent,
): WorkspaceEngine["schemas"]["JobUpdateEvent"] | null => {
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
  if (jobId == null) return null;

  const updatedAt = new Date(updated_at);
  const status =
    conclusion != null
      ? convertConclusion(conclusion)
      : convertStatus(externalStatus);

  const startedAt = new Date(run_started_at);
  const isJobCompleted = exitedStatus.includes(status);
  const completedAt = isJobCompleted ? updatedAt : null;

  const externalId = id.toString();
  const Run = `https://github.com/${repository.owner.login}/${repository.name}/actions/runs/${id}`;
  const Workflow = `${Run}/workflow`;
  const links = { Run, Workflow };
  const linksStr = JSON.stringify(links);
  const metadata = {
    [String(ReservedMetadataKey.Links)]: linksStr,
    run_url: Run,
  } as Record<string, string>;

  return {
    id: jobId,
    job: {
      id: jobId,
      externalId,
      createdAt: startedAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      completedAt: completedAt?.toISOString() ?? undefined,
      startedAt: startedAt.toISOString(),
      workflowJobId: "",
      status: convertStatusToOapiStatus(status),
      releaseId: "",
      jobAgentConfig: {
        type: "github-app",
        installationId: event.installation?.id ?? 0,
        owner: repository.owner.login,
        repo: repository.name,
        workflowId: event.workflow_run.workflow_id,
      },
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
};

const getAllWorkspaceIds = () =>
  db
    .select({ id: schema.workspace.id })
    .from(schema.workspace)
    .then((rows) => rows.map((row) => row.id));

export const handleWorkflowRunEvent = async (event: WorkflowRunEvent) => {
  const oapiEvent = generateOapiEvent(event);
  if (oapiEvent == null) return;
  const workspaceIds = await getAllWorkspaceIds();

  for (const workspaceId of workspaceIds)
    await sendGoEvent({
      workspaceId,
      eventType: Event.JobUpdated,
      data: oapiEvent,
      timestamp: Date.now(),
    });
};
