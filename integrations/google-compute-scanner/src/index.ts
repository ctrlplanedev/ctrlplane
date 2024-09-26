import type { SetTargetProvidersTargetsRequestTargetsInner } from "@ctrlplane/node-sdk";
import { CronJob } from "cron";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import {
  getKubernetesClusters,
  getKubernetesNamespace,
  gkeLogger,
} from "./gke.js";
import { api } from "./sdk.js";

const getScannerId = async () => {
  try {
    const { id } = await api.upsertTargetProvider({
      workspaceId: env.CTRLPLANE_WORKSPACE_ID,
      name: env.CTRLPLANE_SCANNER_NAME,
    });
    return id;
  } catch (error) {
    console.error(error);
    logger.error(error);
    logger.error(
      `Failed to get scanner ID. This could be caused by incorrect workspace (${env.CTRLPLANE_WORKSPACE_ID}), or API Key`,
      { error },
    );
  }
  return null;
};

const scan = async () => {
  const id = await getScannerId();
  if (id == null) return;

  logger.info(`Scanner ID: ${id}`, { id });
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

  const targets: SetTargetProvidersTargetsRequestTargetsInner[] = [
    ...clusters.map((t) => t.target),
    ...namespaces,
  ];

  await api.setTargetProvidersTargets({
    providerId: id,
    setTargetProvidersTargetsRequest: {
      targets: _.uniqBy(targets, (t) => t.identifier),
    },
  });
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
