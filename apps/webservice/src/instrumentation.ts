import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "ctrlplane/webservice" });
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
