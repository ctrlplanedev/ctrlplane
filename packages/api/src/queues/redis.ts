import IORedis from "ioredis";

import { env } from "../config";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
