import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { scan } from "./scanner.js";

logger.info(
  `Starting Terraform Cloud scanner for organization '${env.TFE_ORGANIZATION}' in workspace '${env.CTRLPLANE_WORKSPACE}'`,
);

const runScan = () =>
  scan().catch((error) => {
    const scanType = env.CRON_ENABLED === true ? "Scheduled" : "One-time";
    logger.error(`${scanType} scan failed:`, error);
    process.exit(1);
  });

env.CRON_ENABLED === true
  ? (() => {
      logger.info(`Cron job enabled. Scheduling scans at '${env.CRON_TIME}'`);
      new CronJob(env.CRON_TIME, runScan).start();
    })()
  : (() => {
      logger.info("Cron job disabled. Running in one-time execution mode.");
      runScan()
        .then(() => logger.info("One-time scan completed. Exiting."))
        .finally(() => process.exit(0));
    })();
