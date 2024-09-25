import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "ctrlplane/webservice" });

  const provider = new NodeTracerProvider();
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
        enabled: true,
        addSqlCommenterCommentToQueries: true,
      }),
    ],
  });
}
