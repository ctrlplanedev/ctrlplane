import { Kafka } from "kafkajs";
import { z } from "zod";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { WorkspaceEngine } from "./workspace-engine.js";

const kafka = new Kafka({
  clientId: "workspace-engine",
  brokers: env.KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "workspace-engine" });

const workspaceEngines = new Map<string, WorkspaceEngine>();
const getWorkspaceEngine = (workspaceId: string) => {
  const engine = workspaceEngines.get(workspaceId);
  if (engine != null) return engine;

  const newEngine = new WorkspaceEngine();
  workspaceEngines.set(workspaceId, newEngine);

  return newEngine;
};

export const startConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "ctrlplane-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const { key, value } = message;
      if (key == null || value == null) {
        logger.error("Invalid message", { message });
        return;
      }

      const parsedKey = z.string().uuid().safeParse(key);
      if (!parsedKey.success) {
        logger.error("Invalid key", { key });
        return;
      }

      const { data: workspaceId } = parsedKey;
      const engine = getWorkspaceEngine(workspaceId);

      await engine.readMessage(value);
    },
  });
};
