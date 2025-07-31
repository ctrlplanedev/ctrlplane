import type { Producer } from "kafkajs";
import { Kafka } from "kafkajs";

import type { EventPayload, Message } from "./events.js";
import { env } from "../config.js";

let kafka: Kafka | null = null;
let producer: Producer | null = null;

const getKafka = () => {
  kafka ??= new Kafka({
    clientId: "ctrlplane-events",
    brokers: env.KAFKA_BROKERS.split(","),
  });
  return kafka;
};

const getProducer = async () => {
  if (producer == null) {
    producer = getKafka().producer();
    await producer.connect();
  }
  return producer;
};

export const sendEvent = async <T extends keyof EventPayload>(
  message: Message<T> | Message<T>[],
) => {
  const messages = Array.isArray(message) ? message : [message];
  const producer = await getProducer();
  await producer.send({
    topic: "ctrlplane-events",
    messages: messages.map((message) => ({
      key: message.workspaceId,
      value: JSON.stringify(message),
      timestamp: message.timestamp.toString(),
    })),
  });
};
