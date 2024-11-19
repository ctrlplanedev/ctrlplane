import { CronJob } from "cron";

import { logger } from "@ctrlplane/logger";
import { ResourceProvider } from "@ctrlplane/node-sdk";

import {
  eksLogger,
  getKubernetesClusters,
  getKubernetesNamespace,
} from "./aws.js";
import { env } from "./config.js";
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
  logger.info("Running aws compute scanner", {
    date: new Date().toISOString(),
  });

  const clusters = await getKubernetesClusters();
  eksLogger.info(`Found ${clusters.length} clusters`, {
    count: clusters.length,
  });

  const namespaces = await getKubernetesNamespace(clusters);
  eksLogger.info(`Found ${namespaces.length} namespaces`, {
    count: namespaces.length,
  });

  await scanner.set([...clusters.map((t) => t.resource), ...namespaces]);
};

logger.info(
  `Starting aws compute scanner from project '${env.CTRLPLANE_AWS_TARGET_NAME}' into workspace '${env.CTRLPLANE_WORKSPACE_ID}'`,
  env,
);

scan().catch(console.error);
if (env.CRON_ENABLED) {
  logger.info(`Enabling cron job, ${env.CRON_TIME}`, { time: env.CRON_TIME });
  new CronJob(env.CRON_TIME, scan).start();
}
