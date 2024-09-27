import { BullMQInstrumentation } from "@appsignal/opentelemetry-instrumentation-bullmq";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { env } from "~/env";

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "ctrlplane/webservice",
  }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-net": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-dns": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-http": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-pg": {
        enabled: true,
        enhancedDatabaseReporting: true,
        addSqlCommenterCommentToQueries: true,
      },
      "@opentelemetry/instrumentation-ioredis": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-winston": {
        enabled: true,
      },
    }),
    new BullMQInstrumentation({
      enabled: true,
    }),
  ],
  sampler:
    env.NODE_ENV === "development"
      ? new AlwaysOnSampler()
      : new TraceIdRatioBasedSampler(env.OTEL_SAMPLER_RATIO),
});

try {
  sdk.start();
  console.log("Tracing initialized");
} catch (error) {
  console.error("Error initializing tracing", error);
}
