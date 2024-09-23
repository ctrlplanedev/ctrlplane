import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { registerOTel } from "@vercel/otel";

import { env } from "~/env";

export async function register() {
  if (env.NEXT_RUNTIME === "nodejs") await import("./instrumentation");
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
