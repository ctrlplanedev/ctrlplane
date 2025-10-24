import type { Span } from "@ctrlplane/logger";
import type { Producer } from "kafkajs";
import { Kafka } from "kafkajs";

import { logger, SpanStatusCode } from "@ctrlplane/logger";

import type {
  EventPayload,
  GoEventPayload,
  GoMessage,
  Message,
} from "./events.js";
import { env } from "../config.js";
import { createSpanWrapper } from "../span.js";

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

export const sendGoEvent = createSpanWrapper(
  "sendGoEvent",
  async <T extends keyof GoEventPayload>(
    span: Span,
    message: GoMessage<T> | GoMessage<T>[],
  ) => {
    try {
      const messages = Array.isArray(message) ? message : [message];
      span.setAttribute("event.type", messages[0]?.eventType ?? "");
      span.setAttribute("workspace.id", messages[0]?.workspaceId ?? "");
      const topic = "workspace-events";
      const producer = await getProducer();
      await producer.send({
        topic,
        messages: messages.map((message) => ({
          key: message.workspaceId,
          value: JSON.stringify(message),
        })),
      });
      log.info("Sent event", { messages });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });
      log.error("Failed to send event", { error });
      throw error;
    }
  },
);

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
