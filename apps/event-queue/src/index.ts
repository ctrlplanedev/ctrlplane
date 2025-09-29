import { createServer } from "node:http";
import { Kafka } from "kafkajs";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { getHandler, parseKafkaMessage } from "./events/index.js";

const kafka = new Kafka({
  clientId: "ctrlplane-events",
  brokers: env.KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "ctrlplane-events" });

const EVENT_TIMEOUT = 240_000;

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

      const handler = getHandler(String(event.eventType));
      if (handler == null) {
        logger.error("No handler found for event type", {
          eventType: event.eventType,
        });
        return;
      }

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Event handler timeout: took longer than ${EVENT_TIMEOUT}ms for event ${JSON.stringify(event)}`,
                ),
              ),
            EVENT_TIMEOUT,
          ),
        );
        await Promise.race([handler(event), timeoutPromise]);

        logger.info("Successfully handled event", {
          event,
          eventType: event.eventType,
        });
      } catch (error) {
        logger.error("Failed to handle event", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          event,
          eventType: event.eventType,
        });
      }
    },
  });
};

start();

const port = env.PORT;
const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  res.writeHead(404);
  res.end();
});

const closeServer = () => server.close(() => process.exit(0));

server.listen(port, () => {
  logger.info(`Health check endpoint listening on port ${port}`);
});

const shutdown = () => {
  logger.warn("Exiting...");
  consumer.disconnect().then(closeServer);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
