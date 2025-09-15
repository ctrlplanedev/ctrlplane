import { Kafka } from "kafkajs";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { getHandler, parseKafkaMessage } from "./events/index.js";

const kafka = new Kafka({
  clientId: "ctrlplane-events",
  brokers: env.KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "ctrlplane-events" });

export const start = async () => {
  logger.info("Starting event queue", { brokers: env.KAFKA_BROKERS });
  await consumer.connect();
  await consumer.subscribe({ topic: "ctrlplane-events", fromBeginning: false });
  logger.info("Subscribed to ctrlplane-events topic");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const start = performance.now();
      logger.info("Received event", {
        topic,
        partition,
        message: message.value?.toString() ?? "No message",
      });

      const event = parseKafkaMessage(message);
      if (event == null) {
        logger.error("Failed to parse Kafka message", { message });
        return;
      }

      const handler = getHandler(String(event.eventType));
      if (handler == null) {
        logger.error("No handler found for event type", {
          eventType: event.eventType,
        });
        return;
      }

      try {
        await handler(event);
        const end = performance.now();
        const duration = end - start;
        if (duration >= 500) {
          logger.warn("Handled event, but took longer than 500ms", {
            event,
            eventType: event.eventType,
            duration: `${duration}ms`,
          });
          return;
        }

        logger.info("Successfully handled event", {
          event,
          eventType: event.eventType,
          duration: `${end - start}ms`,
        });
      } catch (error) {
        const end = performance.now();
        logger.error("Failed to handle event", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          event,
          eventType: event.eventType,
          duration: `${end - start}ms`,
        });
      }
    },
  });
};

start();
