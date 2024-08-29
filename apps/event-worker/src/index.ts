import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-execution-dispatch/index.js";
import { redis } from "./redis.js";
import { createTargetScanWorker } from "./target-scan/index.js";

const targetScanWorker = createTargetScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();

const shutdown = () => {
  logger.warn("Exiting...");

  Promise.all([
    targetScanWorker.close(),
    dispatchExecutionJobWorker.close(),
    redis.quit(),
  ]);

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
