import { CronJob } from "cron";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { env } from "./config.js";

const run = async () => {
  const releaseJobTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .where(eq(schema.job.status, JobStatus.Pending))
    .then((rows) => rows.map((row) => row.release_job_trigger));

  if (releaseJobTriggers.length === 0) return;
  console.log(
    `Found [${releaseJobTriggers.length}] release job triggers to dispatch`,
  );

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};

const releaseJobTriggerPolicyChecker = new CronJob(env.CRON_TIME, run);

console.log("Starting job config policy checker cronjob");

run().catch(console.error);

if (env.CRON_ENABLED) releaseJobTriggerPolicyChecker.start();
