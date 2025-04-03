import { logger } from "@ctrlplane/logger";

import { register } from "./instrumentation.js";
import { redis } from "./redis.js";
import { createReleaseNewVersionWorker } from "./releases/new-version/index.js";
import { createReleaseVariableChangeWorker } from "./releases/variable-change/index.js";
import { createResourceScanWorker } from "./resource-scan/index.js";
import { workers } from "./workers/index.js";

console.log("Registering instrumentation...");
await register();

const allWorkers = [
  createResourceScanWorker(),
  createReleaseNewVersionWorker(),
  createReleaseVariableChangeWorker(),
  ...Object.values(workers),
];

const shutdown = () => {
  logger.warn("Exiting...");
  Promise.all(allWorkers.map((w) => w?.close())).then(async () => {
    await redis.quit();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
