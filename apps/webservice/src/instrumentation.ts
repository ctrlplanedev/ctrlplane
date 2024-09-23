import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { registerOTel } from "@vercel/otel";

export async function register() {
  await import("./instrumentation");
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
