import { inArray, lte } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { handleHookEvent } from "@ctrlplane/events";
import { EnvironmentEvent } from "@ctrlplane/validators/events";

export const run = async () => {
  const expiredEnvironments = await db
    .select()
    .from(SCHEMA.environment)
    .where(lte(SCHEMA.environment.expiresAt, new Date()));
  if (expiredEnvironments.length === 0) return;

  const events = expiredEnvironments.map((env) => ({
    type: EnvironmentEvent.Deleted,
    createdAt: new Date().toISOString(),
    payload: { environmentId: env.id },
  }));
  await Promise.all(events.map(handleHookEvent));

  const envIds = expiredEnvironments.map((env) => env.id);
  await db
    .delete(SCHEMA.environment)
    .where(inArray(SCHEMA.environment.id, envIds));
};
