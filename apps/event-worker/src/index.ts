import { logger } from "@ctrlplane/logger";

import { redis } from "./redis.js";
import { createTargetScanWorker } from "./target-scan/index.js";

const targetScanWorker = createTargetScanWorker();

const shutdown = () => {
  logger.warn("Exiting...");

  targetScanWorker.close();
  redis.quit();

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
