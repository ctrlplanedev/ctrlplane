import { and, eq, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueAllReleaseTargetsDesiredVersion } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
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

// Argo Workflow phases: Pending | Running | Succeeded | Failed | Error.
// Error covers controller/infra failures (timeouts, unschedulable pods, exit
// handler crashes); ctrlplane has no separate enum value, so it folds into
// Failure alongside user-code Failed.
const statusMap: Record<string, JobStatus> = {
  Succeeded: JobStatus.Successful,
  Failed: JobStatus.Failure,
  Error: JobStatus.Failure,
  Running: JobStatus.InProgress,
  Pending: JobStatus.Pending,
};

export const mapTriggerToStatus = (trigger: string): JobStatus | null =>
  statusMap[trigger] ?? null;

export const getJobId = (payload: ArgoWorkflowPayload) => payload.jobId;

export const handleArgoWorkflow = async (payload: ArgoWorkflowPayload) => {
  const { uid, phase, startedAt, finishedAt, workflowName } = payload;

  const jobId = getJobId(payload);
  if (jobId == null) {
    logger.warn("Argo webhook missing job-id label, ignoring", {
      workflowName,
      uid,
      phase,
    });
    return;
  }

  const status = mapTriggerToStatus(phase);
  if (status == null) {
    logger.warn("Argo webhook with unmapped phase, ignoring", {
      workflowName,
      uid,
      phase,
      jobId,
    });
    return;
  }

  const isCompleted = exitedStatus.includes(status);
  const completedAt =
    isCompleted && finishedAt != null ? new Date(finishedAt) : null;

  // Filter on status NOT IN exitedStatus so a late-arriving non-terminal event
  // (Running/Pending) cannot regress a job that already settled to a terminal
  // state. The sensor fans out ~13 near-simultaneous fires per workflow; this
  // makes the handler idempotent without a separate read+transaction.
  const [updated] = await db
    .update(schema.job)
    .set({
      externalId: uid,
      status,
      ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
      completedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.job.id, jobId),
        notInArray(schema.job.status, exitedStatus),
      ),
    )
    .returning();

  if (updated == null) {
    logger.info("Argo webhook produced no update", {
      workflowName,
      uid,
      phase,
      jobId,
      mappedStatus: status,
    });
    return;
  }

  logger.info("Argo webhook updated job", {
    workflowName,
    uid,
    phase,
    jobId,
    mappedStatus: status,
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
    .then((rows) => rows[0] ?? null);

  if (result?.workspaceId == null) return;
  enqueueAllReleaseTargetsDesiredVersion(db, result.workspaceId);
};
