import { logger } from "@ctrlplane/logger";

import { register } from "./instrumentation.js";
import { redis } from "./redis.js";
import { workers } from "./workers/index.js";

console.log("Registering instrumentation...");
await register();

const shutdown = () => {
  logger.warn("Exiting...");
  Promise.all(Object.values(workers).map((w) => w?.close())).then(async () => {
    await redis.quit();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
