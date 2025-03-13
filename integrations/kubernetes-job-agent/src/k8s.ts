import k8s from "@kubernetes/client-node";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";

const getKubeConfig = (configPath?: string | null) => {
  const kc = new k8s.KubeConfig();
  try {
    if (configPath) {
      logger.info(`Loading config from file ${configPath}`);
      kc.loadFromFile(configPath);
    } else {
      logger.info(`Loading config from default.`);
      kc.loadFromDefault();
    }
    return kc;
  } catch (error) {
    logger.error(
      `Failed to load KubeConfig: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

let _client: k8s.BatchV1Api | null = null;
export const getBatchClient = () => {
  if (_client) return _client;

  try {
    const kc = getKubeConfig(env.KUBE_CONFIG_PATH);
    const cu = kc.getCurrentUser();
    logger.info(`Current user: ${cu?.name ?? cu?.username ?? "unknown"}`);

    logger.info("Creating BatchV1Api client...");
    const batchapi = kc.makeApiClient(k8s.BatchV1Api);

    logger.info("Batch V1 API client created successfully.");
    _client = batchapi;

    return batchapi;
  } catch (error) {
    logger.error(
      `Failed to create BatchV1Api client: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

export const getJobStatus = async (namespace: string, name: string) => {
  try {
    logger.info(`Fetching job status for ${name} in namespace ${namespace}`);
    const { body } = await getBatchClient().readNamespacedJob(name, namespace);
    const { failed = 0, succeeded = 0, active = 0 } = body.status ?? {};
    const message = body.metadata?.name ?? "";

    if (failed > 0) {
      logger.warn(`Job ${name} in namespace ${namespace} failed`);
      return { status: "failure" as const, message };
    }

    if (active > 0) {
      logger.info(`Job ${name} in namespace ${namespace} is in progress`);
      return { status: "in_progress" as const, message };
    }

    if (succeeded > 0) {
      logger.info(
        `Job ${name} in namespace ${namespace} completed successfully`,
      );
      return { status: "successful" as const, message };
    }

    logger.warn(`Job ${name} in namespace ${namespace} has an unknown status`);
    return {};
  } catch (error) {
    logger.error(
      `Error fetching job status for ${name} in namespace ${namespace}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      status: "invalid_job_agent" as const,
      message:
        error instanceof Error && "body" in error
          ? (error.body as any).message
          : "Unknown error occurred",
    };
  }
};
