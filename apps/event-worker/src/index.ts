import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-dispatch/index.js";
import { redis } from "./redis.js";
import { createReleaseNewVersionWorker } from "./releases/new-version/index.js";
import { createReleaseVariableChangeWorker } from "./releases/variable-change/index.js";
import { createResourceScanWorker } from "./resource-scan/index.js";

const resourceScanWorker = createResourceScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();
const releaseNewVersionWorker = createReleaseNewVersionWorker();
const releaseVariableChangeWorker = createReleaseVariableChangeWorker();

const shutdown = () => {
  logger.warn("Exiting...");
  Promise.all([
    resourceScanWorker.close(),
    dispatchExecutionJobWorker.close(),
    releaseNewVersionWorker.close(),
    releaseVariableChangeWorker.close(),
  ]).then(async () => {
    await redis.quit();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
