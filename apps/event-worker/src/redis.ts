import IORedis from "ioredis";

import { env } from "./config.js";

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
