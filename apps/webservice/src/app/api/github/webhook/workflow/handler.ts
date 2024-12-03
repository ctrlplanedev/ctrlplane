import type { WorkflowRunEvent } from "@octokit/webhooks-types";

import {
  and,
  count,
  desc,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  onJobCompletion,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
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

const maybeRetryJob = async (job: schema.Job) => {
  const jobInfo = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.releaseJobTrigger.jobId, job.id))
    .then(takeFirstOrNull);

  if (jobInfo == null) return;

  const latestRelease = await db
    .select()
    .from(schema.release)
    .where(eq(schema.release.deploymentId, jobInfo.deployment.id))
    .orderBy(desc(schema.release.createdAt))
    .limit(1)
    .then(takeFirst);

  if (latestRelease.id !== jobInfo.release.id) return;

  const releaseJobTriggers = await db
    .select({
      count: count(),
    })
    .from(schema.releaseJobTrigger)
    .where(eq(schema.releaseJobTrigger.releaseId, jobInfo.release.id))
    .then(takeFirst);

  const { count: releaseJobTriggerCount } = releaseJobTriggers;

  if (releaseJobTriggerCount >= jobInfo.deployment.retryCount) return;

  const createTrigger = createReleaseJobTriggers(db, "new_release")
    .releases([jobInfo.release.id])
    .environments([jobInfo.release_job_trigger.environmentId]);

  const trigger =
    jobInfo.release_job_trigger.causedById != null
      ? await createTrigger
          .causedById(jobInfo.release_job_trigger.causedById)
          .insert()
      : await createTrigger.insert();

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(trigger)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch()
    .then(() => {
      logger.info(
        `Retry job for release ${jobInfo.release.id} and resource ${jobInfo.release_job_trigger.resourceId} created and dispatched.`,
      );
    });
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

  if (job.status === JobStatus.Failure) await maybeRetryJob(job);
  if (job.status === JobStatus.Completed) return onJobCompletion(job);
};
