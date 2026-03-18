import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueAllReleaseTargetsDesiredVersion } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

/**
 * TFC notification trigger → ctrlplane job status.
 * https://developer.hashicorp.com/terraform/cloud-docs/workspaces/settings/notifications#notification-triggers
 */
const triggerStatusMap: Record<string, JobStatus> = {
  "run:created": JobStatus.Pending,
  "run:planning": JobStatus.InProgress,
  "run:needs_attention": JobStatus.ActionRequired,
  "run:applying": JobStatus.InProgress,
  "run:completed": JobStatus.Successful,
  "run:errored": JobStatus.Failure,
};

export const mapTriggerToStatus = (trigger: string): JobStatus | null =>
  triggerStatusMap[trigger] ?? null;

const uuidRegex =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/;

/**
 * Extract the ctrlplane job ID from the TFC run message.
 * The dispatcher sets: "Triggered by ctrlplane job <uuid>"
 */
const extractJobId = (runMessage: string): string | null => {
  const match = uuidRegex.exec(runMessage);
  return match ? match[0] : null;
};

export const handleRunNotification = async (payload: {
  run_url: string;
  run_id: string;
  run_message: string;
  workspace_name: string;
  organization_name: string;
  notifications: Array<{ message: string; trigger: string }>;
}) => {
  if (payload.notifications.length === 0) return;

  const notification = payload.notifications[0]!;
  const status = mapTriggerToStatus(notification.trigger);
  if (status == null) {
    logger.warn("Unknown TFC notification trigger, ignoring", {
      trigger: notification.trigger,
    });
    return;
  }

  const jobId = extractJobId(payload.run_message);
  if (jobId == null) return;

  const now = new Date();
  const isCompleted = exitedStatus.includes(status);
  const isInProgress = status === JobStatus.InProgress;

  const [updated] = await db
    .update(schema.job)
    .set({
      externalId: payload.run_id,
      status,
      updatedAt: now,
      message: notification.message,
      ...(isInProgress ? { startedAt: now } : {}),
      ...(isCompleted ? { completedAt: now } : {}),
    })
    .where(eq(schema.job.id, jobId))
    .returning();

  if (updated == null) return;

  // Derive workspace URL from run_url (works for both TFC and TFE)
  const runUrlParts = payload.run_url.split("/runs/");
  const workspaceUrl = runUrlParts[0] ?? payload.run_url;
  const links = JSON.stringify({
    Run: payload.run_url,
    Workspace: workspaceUrl,
  });
  const metadataEntries = [
    { jobId, key: String(ReservedMetadataKey.Links), value: links },
    { jobId, key: "run_url", value: payload.run_url },
  ];

  for (const entry of metadataEntries)
    await db
      .insert(schema.jobMetadata)
      .values(entry)
      .onConflictDoUpdate({
        target: [schema.jobMetadata.key, schema.jobMetadata.jobId],
        set: { value: entry.value },
      });

  const result = await db
    .select({ workspaceId: schema.deployment.workspaceId })
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

  if (result?.workspaceId != null)
    enqueueAllReleaseTargetsDesiredVersion(db, result.workspaceId);
};
