import IORedis from "ioredis";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";

const log = logger.child({
  module: "redis",
});

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  log.info("Redis connected");
});

redis.on("error", (err) => {
  log.error("Redis error", err);
  console.error("Redis error", err);
});
