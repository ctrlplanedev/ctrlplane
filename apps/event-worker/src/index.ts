import { logger } from "@ctrlplane/logger";

import { register } from "./instrumentation.js";
import { redis } from "./redis.js";
import { workers } from "./workers/index.js";
import { createReleaseNewVersionWorker } from "./workers/releases/new-version/index.js";
import { createReleaseVariableChangeWorker } from "./workers/releases/variable-change/index.js";

console.log("Registering instrumentation...");
await register();

const allWorkers = [
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
