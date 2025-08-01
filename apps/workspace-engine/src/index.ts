import { Kafka } from "kafkajs";
import { z } from "zod";

import { Event } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { eventHandlers } from "./event-handlers/index.js";
import { getWorkspaceStore } from "./workspace-store/workspace-store.js";

const kafka = new Kafka({
  clientId: "workspace-engine",
  brokers: env.KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "workspace-engine" });
const MessageSchema = z.object({
  workspaceId: z.string().uuid(),
  eventType: z.nativeEnum(Event),
  eventId: z.string().uuid(),
  timestamp: z.number(),
  source: z.enum(["api", "scheduler", "user-action"]),
  payload: z.any(),
});

export const startConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "ctrlplane-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const { value } = message;
        if (value == null) {
          logger.error("Invalid message", { message });
          return;
        }

        const parsedMessage = MessageSchema.safeParse(
          JSON.parse(value.toString()),
        );

        if (!parsedMessage.success) {
          logger.error("Invalid message", { message });
          return;
        }

        const { workspaceId, eventType, payload } = parsedMessage.data;
        await eventHandlers[eventType](getWorkspaceStore(workspaceId), payload);
      } catch (error) {
        logger.error("Error processing message", { message, error });
      }
    },
  });
};
