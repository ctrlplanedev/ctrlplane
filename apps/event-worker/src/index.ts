import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-execution-dispatch";
import { redis } from "./redis";
import { createTargetScanWorker } from "./target-scan";

const targetScanWorker = createTargetScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();

const shutdown = async () => {
  logger.warn("Exiting...");

  await Promise.all([
    targetScanWorker.close(),
    dispatchExecutionJobWorker.close(),
    redis.quit(),
  ]);

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
