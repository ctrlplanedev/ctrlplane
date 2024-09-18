import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { scan } from "./scanner.js";

logger.info(
  `Starting Terraform Cloud scanner for organization '${env.TFE_ORGANIZATION}' in workspace '${env.CTRLPLANE_WORKSPACE}'`,
);

scan().catch((error) => {
  logger.error("Initial scan failed:", error);
});

if (env.CRON_ENABLED) {
  logger.info(`Cron job enabled. Scheduling scans at '${env.CRON_TIME}'`);
  new CronJob(env.CRON_TIME, () => {
    scan().catch((error) => {
      logger.error("Scheduled scan failed:", error);
    });
  }).start();
}
