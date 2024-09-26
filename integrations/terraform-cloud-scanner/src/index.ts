import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { scan } from "./scanner.js";

logger.info(
  `Starting Terraform Cloud scanner for organization '${env.TFE_ORGANIZATION}' in workspace '${env.CTRLPLANE_WORKSPACE_ID}'`,
);

if (env.CRON_ENABLED.toLowerCase() === "true") {
  logger.info(`Cron job enabled. Scheduling scans at '${env.CRON_TIME}'`);
  new CronJob(env.CRON_TIME, () => {
    scan().catch((error) => {
      logger.error("Scheduled scan failed:", error);
    });
  }).start();
}

scan()
  .catch((error) => {
    logger.error("Initial scan failed:", error);
  })
  .finally(() => {
    if (env.CRON_ENABLED.toLowerCase() === "false") {
      process.exit(0);
    }
  });
