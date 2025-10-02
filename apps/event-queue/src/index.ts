import { createServer } from "node:http";
import type { IMemberAssignment } from "kafkajs";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { getHandler, parseKafkaMessage } from "./events/index.js";
import { getUrl, kafka, topic } from "./workspace-engine/url.js";

const consumer = kafka.consumer({ groupId: "ctrlplane-events" });

let ready = false;
let lastAssignment: IMemberAssignment | null = null;

export const start = async () => {
  logger.info("Starting event queue", { brokers: env.KAFKA_BROKERS });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  await getUrl("test");

  const ev = consumer.events;

  consumer.on(ev.GROUP_JOIN, (e) => {
    const { memberAssignment } = e.payload;
    logger.info("Group joined", { memberAssignment });
    lastAssignment = memberAssignment;
    ready = true;
  });

  consumer.on(ev.REBALANCING, (event) => {
    logger.info("Group rebalancing", { event });
    ready = false;
  });

  consumer.on(ev.DISCONNECT, () => {
    ready = false;
    logger.warn("Not ready: disconnected");
  });

  consumer.on(ev.CRASH, (e) => {
    ready = false;
    logger.error("Consumer crashed", {
      event: e.payload.error.message,
      cause: e.payload.error.cause,
    });
  });

  await consumer.run({
    partitionsConsumedConcurrently: env.KAFKA_PARTITIONS_CONSUMED_CONCURRENTLY,
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
        await handler(event);

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

  if (req.url === "/assignment") {
    res.writeHead(200);
    res.end(JSON.stringify(lastAssignment));
    return;
  }

  if (req.url === "/ready") {
    if (ready) {
      res.writeHead(200);
      res.end("ok");
      return;
    }

    res.writeHead(503);
    res.end("not-ready");
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
