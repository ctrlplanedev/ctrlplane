import { Kafka } from "kafkajs";

import type { EventPayload, Message } from "./events.js";
import { env } from "../config.js";

const kafka = new Kafka({
  clientId: "ctrlplane-events",
  brokers: env.KAFKA_BROKERS.split(","),
});

const producer = kafka.producer();

export const sendEvent = async <T extends keyof EventPayload>(
  message: Message<T> | Message<T>[],
) => {
  const messages = Array.isArray(message) ? message : [message];
  await producer.send({
    topic: "ctrlplane-events",
    messages: messages.map((message) => ({
      key: message.workspaceId,
      value: JSON.stringify(message),
      timestamp: message.timestamp.toString(),
    })),
  });
};
