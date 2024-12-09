import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-dispatch/index.js";
import { redis } from "./redis.js";
import {
  createAwsResourceScanWorker,
  createGoogleResourceScanWorker,
} from "./target-scan/index.js";

const resourceGoogleScanWorker = createGoogleResourceScanWorker();
const resourceAwsScanWorker = createAwsResourceScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();

const shutdown = () => {
  logger.warn("Exiting...");
  resourceAwsScanWorker.close();
  resourceGoogleScanWorker.close();
  dispatchExecutionJobWorker.close();

  redis.quit();

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
