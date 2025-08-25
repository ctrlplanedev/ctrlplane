import { Kafka } from "kafkajs";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";

const kafka = new Kafka({
  clientId: "event-queue",
  brokers: env.KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "event-queue" });

export const start = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "ctrlplane-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      logger.info("Received event", {
        topic,
        partition,
        message: message.value?.toString() ?? "No message",
      });
    },
  });
};
