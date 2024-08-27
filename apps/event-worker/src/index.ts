import { logger } from "@ctrlplane/logger";

import { redis } from "./redis";
import { createTargetScanWorker } from "./target-scan";

const targetScanWorker = createTargetScanWorker();

const shutdown = () => {
  logger.warn("Exiting...");

  targetScanWorker.close();
  redis.quit();

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
