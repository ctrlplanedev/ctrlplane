// global-setup.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { FullConfig } from "@playwright/test";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    serviceName: "ctrlplane-e2e",
    instrumentations: [
        new FetchInstrumentation(),
    ],
});

export default async function globalSetup(_config: FullConfig) {
    registerInstrumentations({
        instrumentations: [
            new FetchInstrumentation({
                clearTimingResources: true,
                semconvStabilityOptIn: "beta",
            }),
        ],
    });
    sdk.start();

    return async () => {
        await sdk.shutdown();
    };
}
