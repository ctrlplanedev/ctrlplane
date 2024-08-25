import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

import { env } from "./config.js";

const config = new Configuration({
  basePath: `${env.CTRLPLANE_API_URL}/api`,
  apiKey: env.CTRLPLANE_API_KEY,
});

export const api = new DefaultApi(config);
