import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-dispatch/index.js";
import { redis } from "./redis.js";
import { createReleaseNewVersionWorker } from "./releases/new-version/index.js";
import { createResourceScanWorker } from "./resource-scan/index.js";

const resourceScanWorker = createResourceScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();
const releaseNewVersionWorker = createReleaseNewVersionWorker();

const shutdown = () => {
  logger.warn("Exiting...");
  Promise.all([
    resourceScanWorker.close(),
    dispatchExecutionJobWorker.close(),
    releaseNewVersionWorker.close(),
  ]).then(async () => {
    await redis.quit();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
