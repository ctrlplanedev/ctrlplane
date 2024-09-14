import { CronJob } from "cron";

import { eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { job, releaseJobTrigger } from "@ctrlplane/db/schema";
import {
  cancelOldJobConfigsOnJobDispatch,
  dispatchJobConfigs,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";

import { env } from "./config.js";

const run = async () => {
  const jobConfigs = await db
    .select()
    .from(releaseJobTrigger)
    .leftJoin(job, eq(job.jobConfigId, releaseJobTrigger.id))
    .where(isNull(job.jobConfigId));

  if (jobConfigs.length === 0) return;
  console.log(`Found [${jobConfigs.length}] job configs to dispatch`);

  await dispatchJobConfigs(db)
    .jobConfigs(jobConfigs.map((t) => t.release_job_trigger))
    .filter(isPassingAllPolicies)
    .then(cancelOldJobConfigsOnJobDispatch)
    .dispatch();
};

const jobConfigPolicyChecker = new CronJob(env.CRON_TIME, run);

console.log("Starting job config policy checker cronjob");

run().catch(console.error);

if (env.CRON_ENABLED) jobConfigPolicyChecker.start();
