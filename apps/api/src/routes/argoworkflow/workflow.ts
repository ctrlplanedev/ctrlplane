import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueAllReleaseTargetsDesiredVersion } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

interface ArgoWorkflowPayload {
  workflowName: string;
  namespace: string;
  uid: string;
  createdAt: string;
  startedAt: string;
  finishedAt: string | null;
  jobId: string | null;
  phase: string;
  eventType: string;
}

const statusMap: Record<string, JobStatus> = {
  Succeeded: JobStatus.Successful,
  Failed: JobStatus.Failure,
  Running: JobStatus.InProgress,
  Pending: JobStatus.Pending,
};

const extractUuid = (str: string) => {
  const uuidRegex =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/;
  const match = uuidRegex.exec(str);
  return match ? match[0] : null;
};

export const mapTriggerToStatus = (trigger: string): JobStatus | null =>
  statusMap[trigger] ?? null;

export const getJobId = (payload: ArgoWorkflowPayload): string => {
  if (payload.jobId != null && payload.jobId !== "") {
    return payload.jobId;
  }
  return payload.workflowName;
};

export const handleArgoWorkflow = async (payload: ArgoWorkflowPayload) => {
  const { workflowName, uid, phase, startedAt, finishedAt } = payload;

  const jobId = getJobId(payload);
  if (jobId == null) return;

  const status = statusMap[phase] ?? null;
  if (status == null) return;

  const isCompleted = exitedStatus.includes(status);
  const completedAt =
    isCompleted && finishedAt != null ? new Date(finishedAt) : null;

  const [updated] = await db
    .update(schema.job)
    .set({
      externalId: uid,
      status,
      ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
      completedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.job.id, jobId))
    .returning();

  if (updated == null) return;

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
    .then((rows) => rows[0] ?? null);

  if (result?.workspaceId == null) return;
  enqueueAllReleaseTargetsDesiredVersion(db, result.workspaceId);
};
