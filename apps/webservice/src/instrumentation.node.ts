import type { HttpInstrumentationConfig } from "@opentelemetry/instrumentation-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
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
    new HttpInstrumentation({
      enabled: true,
    } as HttpInstrumentationConfig),
    new PgInstrumentation({
      enabled: true,
      enhancedDatabaseReporting: true,
      addSqlCommenterCommentToQueries: true,
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
