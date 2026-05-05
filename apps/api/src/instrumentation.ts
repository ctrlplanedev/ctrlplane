import { env } from "@/config.js";
import { metrics } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

import { logger } from "@ctrlplane/logger";

const stripTrailingSlash = (s: string) => s.replace(/\/$/, "");
const appendMetricsPath = (base: string) =>
  `${stripTrailingSlash(base)}/v1/metrics`;

const metricsUrl =
  env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
  (env.OTEL_EXPORTER_OTLP_ENDPOINT &&
    appendMetricsPath(env.OTEL_EXPORTER_OTLP_ENDPOINT));

if (metricsUrl) {
  const meterProvider = new MeterProvider({
    resource: new Resource({ "service.name": env.OTEL_SERVICE_NAME }),
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: metricsUrl }),
        exportIntervalMillis: 30_000,
      }),
    ],
  });

  metrics.setGlobalMeterProvider(meterProvider);
  logger.info(`OTel metrics enabled (endpoint: ${metricsUrl})`);
} else {
  logger.info(
    "OTel metrics disabled (set OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_METRICS_ENDPOINT to enable)",
  );
}
