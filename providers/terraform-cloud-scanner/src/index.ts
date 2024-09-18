import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { scan } from "./scanner.js";

logger.info(
  `Starting Terraform Cloud scanner for organization '${env.TFE_ORGANIZATION}' in workspace '${env.CTRLPLANE_WORKSPACE}'`,
);

const runScan = () =>
  scan().catch((error) => {
    logger.error(
      env.CRON_ENABLED ? "Scheduled scan failed:" : "One-time scan failed:",
      error,
    );
  });

if (env.CRON_ENABLED) {
  logger.info(`Cron job enabled. Scheduling scans at '${env.CRON_TIME}'`);
  new CronJob(env.CRON_TIME, runScan).start();
} else {
  logger.info("Cron job disabled. Running in one-time execution mode.");
  runScan().finally(() => {
    logger.info("One-time scan completed. Exiting.");
    process.exit(0);
  });
}
