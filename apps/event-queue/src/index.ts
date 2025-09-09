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

      const handler = getHandler(event.eventType);

      try {
        await handler(event);
      } catch (error) {
        logger.error("Failed to handle event", { error });
      }
    },
  });
};

start();
