import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "ctrlplane/event-worker",
  }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter()) as any],
  logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
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
        logHook: (span, record) => {
          record["resource.service.name"] = "ctrlplane/event-worker";
        },
      },
    }),
  ],
  sampler: new AlwaysOnSampler(),
});

try {
  sdk.start();
  console.log("Tracing initialized");
} catch (error) {
  console.error("Error initializing tracing", error);
}
