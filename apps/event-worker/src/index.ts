import { logger } from "@ctrlplane/logger";

import { createDispatchExecutionJobWorker } from "./job-dispatch/index.js";
import { createJobUpdateWorker } from "./job-update/index.js";
import { redis } from "./redis.js";
import { createResourceScanWorker } from "./resource-scan/index.js";

const resourceScanWorker = createResourceScanWorker();
const dispatchExecutionJobWorker = createDispatchExecutionJobWorker();
const jobUpdateWorker = createJobUpdateWorker();

const shutdown = () => {
  logger.warn("Exiting...");
  resourceScanWorker.close();
  dispatchExecutionJobWorker.close();
  jobUpdateWorker.close();
  redis.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
