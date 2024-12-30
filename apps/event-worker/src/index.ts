import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-dispatch/index.js";
import { redis } from "./redis.js";
import {
  createAwsResourceScanWorker,
  createAzureResourceScanWorker,
  createGoogleResourceScanWorker,
} from "./resource-scan/index.js";
import { testAzure } from "./test-azure.js";

testAzure();

const resourceGoogleScanWorker = createGoogleResourceScanWorker();
const resourceAwsScanWorker = createAwsResourceScanWorker();
const resourceAzureScanWorker = createAzureResourceScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();

const shutdown = () => {
  logger.warn("Exiting...");
  resourceAwsScanWorker.close();
  resourceAzureScanWorker.close();
  resourceGoogleScanWorker.close();
  dispatchExecutionJobWorker.close();

  redis.quit();

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
