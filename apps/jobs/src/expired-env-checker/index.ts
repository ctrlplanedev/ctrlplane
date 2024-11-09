import { inArray, lte } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { getEventsForEnvironmentDeleted, handleEvent } from "@ctrlplane/events";

export const run = async () => {
  const expiredEnvironments = await db
    .select()
    .from(SCHEMA.environment)
    .where(lte(SCHEMA.environment.expiresAt, new Date()));
  if (expiredEnvironments.length === 0) return;

  const eventPromises = expiredEnvironments.flatMap(
    getEventsForEnvironmentDeleted,
  );
  const events = (await Promise.all(eventPromises)).flat();
  const handleEventsPromises = events.map(handleEvent);
  await Promise.all(handleEventsPromises);

  const envIds = expiredEnvironments.map((env) => env.id);
  await db
    .delete(SCHEMA.environment)
    .where(inArray(SCHEMA.environment.id, envIds));
};
