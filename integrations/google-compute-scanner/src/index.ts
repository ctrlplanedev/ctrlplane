import { CronJob } from "cron";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ResourceProvider } from "@ctrlplane/node-sdk";

import { env } from "./config.js";
import {
  getKubernetesClusters,
  getKubernetesNamespace,
  gkeLogger,
} from "./gke.js";
import { api } from "./sdk.js";

const scan = async () => {
  const scanner = new ResourceProvider(
    {
      workspaceId: env.CTRLPLANE_WORKSPACE_ID,
      name: env.CTRLPLANE_SCANNER_NAME,
    },
    api,
  );

  const provider = await scanner.get();

  logger.info(`Scanner ID: ${provider.id}`, { id: provider.id });
  logger.info("Running google compute scanner", {
    date: new Date().toISOString(),
  });

  const clusters = await getKubernetesClusters();
  gkeLogger.info(`Found ${clusters.length} clusters`, {
    count: clusters.length,
  });

  const namespaces = await getKubernetesNamespace(clusters);
  gkeLogger.info(`Found ${namespaces.length} namespaces`, {
    count: namespaces.length,
  });

  await scanner.set([...clusters.map((t) => t.target), ...namespaces]);
};

logger.info(
  `Starting google compute scanner from project '${env.GOOGLE_PROJECT_ID}' into workspace '${env.CTRLPLANE_WORKSPACE_ID}'`,
  env,
);

scan().catch(console.error);
if (env.CRON_ENABLED) {
  logger.info(`Enabling cron job, ${env.CRON_TIME}`, { time: env.CRON_TIME });
  new CronJob(env.CRON_TIME, scan).start();
}
