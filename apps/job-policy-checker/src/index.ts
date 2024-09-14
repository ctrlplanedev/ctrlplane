import { CronJob } from "cron";

import { isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { releaseJobTrigger } from "@ctrlplane/db/schema";
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
    .where(isNull(releaseJobTrigger.jobId));

  if (jobConfigs.length === 0) return;
  console.log(`Found [${jobConfigs.length}] job configs to dispatch`);

  await dispatchJobConfigs(db)
    .releaseTriggers(jobConfigs)
    .filter(isPassingAllPolicies)
    .then(cancelOldJobConfigsOnJobDispatch)
    .dispatch();
};

const jobConfigPolicyChecker = new CronJob(env.CRON_TIME, run);

console.log("Starting job config policy checker cronjob");

run().catch(console.error);

if (env.CRON_ENABLED) jobConfigPolicyChecker.start();
