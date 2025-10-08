import type { Producer } from "kafkajs";
import { Kafka } from "kafkajs";

import { logger } from "@ctrlplane/logger";

import type {
  EventPayload,
  GoEventPayload,
  GoMessage,
  Message,
} from "./events.js";
import { env } from "../config.js";

const log = logger.child({ component: "kafka-client" });

let kafka: Kafka | null = null;
let producer: Producer | null = null;

const getKafka = () =>
  (kafka ??= new Kafka({
    clientId: "ctrlplane-events",
    brokers: env.KAFKA_BROKERS.split(","),
  }));

const getProducer = async () => {
  if (producer == null) {
    producer = getKafka().producer();
    await producer.connect();
  }
  return producer;
};

export const sendGoEvent = async <T extends keyof GoEventPayload>(
  message: GoMessage<T> | GoMessage<T>[],
) => {
  const messages = Array.isArray(message) ? message : [message];
  const topic = "workspace-events";
  const producer = await getProducer();
  await producer.send({
    topic,
    messages: messages.map((message) => ({
      key: message.workspaceId,
      value: JSON.stringify(message),
    })),
  });
};

export const sendNodeEvent = async <T extends keyof EventPayload>(
  message: Message<T> | Message<T>[],
) => {
  try {
    const messages = Array.isArray(message) ? message : [message];
    const producer = await getProducer();

    const topic = "ctrlplane-events";
    await producer.send({
      topic,
      messages: messages.map((message) => ({
        key: message.workspaceId,
        value: JSON.stringify(message),
        timestamp: message.timestamp.toString(),
      })),
    });

    log.info("Sent event", { messages });
  } catch (error) {
    log.error("Failed to send event", { error });
  }
};
