import { Kafka } from "kafkajs";
import murmur from "murmurhash-js";

import { logger } from "@ctrlplane/logger";

import { env } from "../config.js";

export const topic = "ctrlplane-events";
export const kafka = new Kafka({
  clientId: "ctrlplane-events",
  brokers: env.KAFKA_BROKERS,
});
/**
 * Kafka-compatible partition for a key using Murmur2.
 * Important: Kafka masks the sign bit (0x7fffffff) on the 32-bit result.
 */
function partitionForWorkspace(workspaceId: string, numPartitions: number) {
  const key = String(workspaceId);
  // murmurhash-js exposes Murmur2 as `murmur2`
  const h = murmur.murmur2(key); // 32-bit signed int
  const positive = h & 0x7fffffff; // mask sign bit like Kafka
  return positive % numPartitions;
}

const getWorkspaceEngineUrl = async () => {
  const statefulSetName = env.WORKSPACE_ENGINE_STATEFUL_SET_NAME;
  const headlessService = env.WORKSPACE_ENGINE_HEADLESS_SERVICE;
  const namespace = env.WORKSPACE_ENGINE_NAMESPACE;
  const port = env.WORKSPACE_ENGINE_PORT;

  if (env.NODE_ENV !== "production") {
    return (_: string) => {
      return `http://localhost:${port}`;
    };
  }

  const admin = kafka.admin();

  await admin.connect();
  const meta = await admin.fetchTopicMetadata({ topics: [topic] });
  const partitions = meta.topics[0]?.partitions.length;
  if (partitions == null) {
    throw new Error("Failed to fetch topic metadata");
  }

  logger.info(`numPartitions = ${partitions}`);
  await admin.disconnect();

  return (workspaceId: string) => {
    const p = partitionForWorkspace(workspaceId, partitions);
    return `${statefulSetName}-${p}.${headlessService}.${namespace}.svc.cluster.local:${port}`;
  };
};

let _getUrl: ((workspaceId: string) => string) | null = null;

export const getUrl = async (workspaceId: string) => {
  if (_getUrl == null) {
    _getUrl = await getWorkspaceEngineUrl();
  }
  return _getUrl(workspaceId);
};
