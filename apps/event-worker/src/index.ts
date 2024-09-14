import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-dispatch/index.js";
import { createjobSyncWorker } from "./job-sync/index.js";
import { redis } from "./redis.js";
import { createTargetScanWorker } from "./target-scan/index.js";

const targetScanWorker = createTargetScanWorker();
const jobSyncWorker = createjobSyncWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();

const shutdown = () => {
  logger.warn("Exiting...");

  targetScanWorker.close();
  jobSyncWorker.close();
  dispatchExecutionJobWorker.close();

  redis.quit();

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
