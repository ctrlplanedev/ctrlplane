import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";

const scan = async () => {
  logger.info("Running google compute scanner", {
    date: new Date().toISOString(),
  });
};

logger.info(
  `Starting google compute scanner from project '${env.GOOGLE_PROJECT_ID}' into workspace '${env.CTRLPLANE_WORKSPACE}'`,
  env,
);

scan().catch(console.error);
if (env.CRON_ENABLED) {
  logger.info(`Enabling cron job, ${env.CRON_TIME}`, { time: env.CRON_TIME });
  new CronJob(env.CRON_TIME, scan).start();
}
