import type { z } from "zod";

import type { Tx } from "../common.js";
import { buildConflictUpdateColumns, takeFirst } from "../common.js";
import * as SCHEMA from "../schema/index.js";
import { environment } from "../schema/index.js";

export const upsertEnv = async (
  db: Tx,
  input: z.infer<typeof SCHEMA.createEnvironment>,
) => {
  const { metadata } = input;

  const env = await db
    .insert(environment)
    .values({ ...input })
    .onConflictDoUpdate({
      target: [environment.name, environment.systemId],
      set: buildConflictUpdateColumns(environment, [
        "description",
        "directory",
        "resourceSelector",
      ]),
    })
    .returning()
    .then(takeFirst);

  if (metadata != null)
    await db.insert(SCHEMA.environmentMetadata).values(
      Object.entries(metadata).map(([key, value]) => ({
        environmentId: env.id,
        key,
        value,
      })),
    );

  return env;
};
