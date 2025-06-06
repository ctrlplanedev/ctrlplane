// Examples:
//
// Run specific jobs with default schedules:
// node index.js -j policy-checker
//
// Run jobs with policy-checker running every 5 minutes:
// node index.js -j "policy-checker=*/5 * * * *"
//
// Run all jobs once:
// node index.js -r

import { parseArgs } from "node:util";
import { CronJob } from "cron";
import { z } from "zod";

import { logger } from "@ctrlplane/logger";

import { run as jobPolicyChecker } from "./policy-checker/index.js";
import { run as timeoutChecker } from "./timeout-checker/index.js";

const jobs: Record<string, { run: () => Promise<void>; schedule: string }> = {
  "policy-checker": { run: jobPolicyChecker, schedule: "* * * * *" },
  "timeout-checker": { run: timeoutChecker, schedule: "* * * * *" },
};

const jobSchema = z.object({
  job: z.array(z.string().transform((value) => value.trim())).optional(),
  runOnce: z.boolean().optional(),
});

const parseJobArgs = () => {
  const { values } = parseArgs({
    options: {
      job: { type: "string", short: "j", multiple: true },
      runOnce: { type: "boolean", short: "r" },
    },
  });
  return jobSchema.parse(values);
};

const getJobConfig = (jobName: string) => {
  const [job, schedule] = jobName.split("=");
  const jobConfig = jobs[job ?? ""];
  if (jobConfig == null)
    throw new Error(`Job ${job} not found in configuration`);
  return { job, schedule: schedule ?? jobConfig.schedule };
};

const parseJobSchedulePairs = (parsedValues: z.infer<typeof jobSchema>) => {
  if (parsedValues.job != null && parsedValues.job.length > 0)
    return parsedValues.job.map(getJobConfig);

  return Object.entries(jobs).map(([job, config]) => ({
    job,
    schedule: config.schedule,
  }));
};

const runJob = async (job: string) => {
  logger.info(`Running job: ${job}`);
  try {
    await jobs[job]?.run();
    logger.info(`Job ${job} completed successfully`);
  } catch (error: any) {
    logger.error(`Error running job ${job}: ${error.message}`, error);
  }
};
const main = async () => {
  const parsedValues = parseJobArgs();
  const jobSchedulePairs = parseJobSchedulePairs(parsedValues);

  logger.info(
    `Starting jobs: ${jobSchedulePairs.map((pair) => pair.job).join(", ")}`,
  );

  if (parsedValues.runOnce) {
    const jobPromises = jobSchedulePairs.map(({ job }) => {
      if (job == null) return Promise.resolve();
      logger.info(`Running job ${job} once`);
      return runJob(job);
    });

    await Promise.all(jobPromises);
    logger.info("All jobs completed. Exiting.");
    process.exit(0);
  }

  for (const { job, schedule } of jobSchedulePairs) {
    if (job == null) continue;

    const cronJob = new CronJob(schedule, () => runJob(job));

    cronJob.start();
    logger.info(`Scheduled job ${job} with cron: ${schedule}`);
    runJob(job);
  }
};

main();
