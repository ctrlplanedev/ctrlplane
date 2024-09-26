import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { scan } from "./scanner.js";

logger.info(
  `Starting Terraform Cloud scanner for organization '${env.TFE_ORGANIZATION}' in workspace '${env.CTRLPLANE_WORKSPACE_ID}'`,
);

if (env.CRON_ENABLED) {
  logger.info(`Cron job enabled. Scheduling scans at '${env.CRON_TIME}'`);
  scan();
  new CronJob(env.CRON_TIME, () => {
    scan().catch((error) => {
      logger.error("Scheduled scan failed:", error);
    });
  }).start();
}

if (!env.CRON_ENABLED)
  scan()
    .then(() => logger.info("Done init scanning."))
    .catch((error) => {
      logger.error("Initial scan failed:", error);
      process.exit(1);
    })
    .finally(() => process.exit(0));
