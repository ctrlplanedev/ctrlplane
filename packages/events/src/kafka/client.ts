import type { Span } from "@ctrlplane/logger";
import type {
  OauthbearerProviderResponse,
  Producer,
  SASLOptions,
} from "kafkajs";
import { Kafka } from "kafkajs";

import { logger, SpanStatusCode } from "@ctrlplane/logger";

import type { GoEventPayload, GoMessage } from "./events.js";
import { env, validateSaslConfig } from "../config.js";
import { createSpanWrapper } from "../span.js";

const log = logger.child({ component: "kafka-client" });

/**
 * Fetches an OAuth2 access token using the standard client credentials grant
 * (RFC 6749 Section 4.4). The token endpoint, client ID, client secret, and
 * scope are all read from env vars so this works with any OIDC-compliant
 * provider (Google, AWS, Azure, Confluent, etc.).
 */
const fetchOAuthToken = async (): Promise<OauthbearerProviderResponse> => {
  const tokenUrl = env.KAFKA_SASL_OAUTHBEARER_TOKEN_URL!;
  const body = new URLSearchParams({ grant_type: "client_credentials" });

  if (env.KAFKA_SASL_OAUTHBEARER_CLIENT_ID)
    body.set("client_id", env.KAFKA_SASL_OAUTHBEARER_CLIENT_ID);
  if (env.KAFKA_SASL_OAUTHBEARER_CLIENT_SECRET)
    body.set("client_secret", env.KAFKA_SASL_OAUTHBEARER_CLIENT_SECRET);
  if (env.KAFKA_SASL_OAUTHBEARER_SCOPE)
    body.set("scope", env.KAFKA_SASL_OAUTHBEARER_SCOPE);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `OAuth token request failed (${res.status}): ${text}`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return { value: data.access_token };
};

const buildSaslConfig = (): SASLOptions | undefined => {
  if (!env.KAFKA_SASL_ENABLED) return undefined;

  const mechanism = env.KAFKA_SASL_MECHANISM;
  switch (mechanism) {
    case "plain":
      return {
        mechanism: "plain",
        username: env.KAFKA_SASL_USERNAME!,
        password: env.KAFKA_SASL_PASSWORD!,
      };
    case "scram-sha-256":
      return {
        mechanism: "scram-sha-256",
        username: env.KAFKA_SASL_USERNAME!,
        password: env.KAFKA_SASL_PASSWORD!,
      };
    case "scram-sha-512":
      return {
        mechanism: "scram-sha-512",
        username: env.KAFKA_SASL_USERNAME!,
        password: env.KAFKA_SASL_PASSWORD!,
      };
    case "oauthbearer":
      return {
        mechanism: "oauthbearer",
        oauthBearerProvider: fetchOAuthToken,
      };
  }
};

let kafka: Kafka | null = null;
let producer: Producer | null = null;

const getKafka = () => {
  if (kafka != null) return kafka;

  validateSaslConfig();

  const sasl = buildSaslConfig();
  kafka = new Kafka({
    clientId: "ctrlplane-events",
    brokers: env.KAFKA_BROKERS.split(","),
    ...(sasl != null ? { ssl: true, sasl } : {}),
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
