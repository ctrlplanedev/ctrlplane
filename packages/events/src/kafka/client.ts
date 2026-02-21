import type { Span } from "@ctrlplane/logger";
import type {
  OauthbearerProviderResponse,
  Producer,
  SASLOptions,
} from "kafkajs";
import { GoogleAuth } from "google-auth-library";
import { Kafka } from "kafkajs";

import { logger, SpanStatusCode } from "@ctrlplane/logger";

import type { GoEventPayload, GoMessage } from "./events.js";
import { env } from "../config.js";
import { createSpanWrapper } from "../span.js";

const log = logger.child({ component: "kafka-client" });

const fetchOIDCToken = async (): Promise<OauthbearerProviderResponse> => {
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
    throw new Error(`OAuth token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return { value: data.access_token };
};

const gcpAuth = new GoogleAuth({
  scopes:
    env.KAFKA_SASL_OAUTHBEARER_SCOPE ??
    "https://www.googleapis.com/auth/cloud-platform",
});

const fetchGCPToken = async (): Promise<OauthbearerProviderResponse> => {
  const client = await gcpAuth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to get GCP access token via ADC");
  return { value: token };
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
        oauthBearerProvider:
          env.KAFKA_SASL_OAUTHBEARER_PROVIDER === "gcp"
            ? fetchGCPToken
            : fetchOIDCToken,
      };
  }
};

let kafka: Kafka | null = null;
let producer: Producer | null = null;

const getKafka = () => {
  if (kafka != null) return kafka;

  const sasl = buildSaslConfig();
  kafka = new Kafka({
    clientId: "ctrlplane-events",
    brokers: env.KAFKA_BROKERS.split(","),
    ssl: env.KAFKA_SSL_ENABLED,
    ...(sasl != null ? { sasl } : {}),
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
