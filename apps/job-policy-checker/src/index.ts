import { CronJob } from "cron";

import { isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { releaseJobTrigger } from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";

import { env } from "./config.js";

const run = async () => {
  const releaseJobTriggers = await db
    .select()
    .from(releaseJobTrigger)
    .where(isNull(releaseJobTrigger.jobId));

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
