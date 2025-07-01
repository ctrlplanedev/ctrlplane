import type { z } from "zod";
import { eq } from "drizzle-orm";

import type { Tx } from "../common.js";
import { buildConflictUpdateColumns, takeFirst } from "../common.js";
import * as SCHEMA from "../schema/index.js";
import { environment, environmentPolicy } from "../schema/index.js";

export const upsertEnv = async (
  db: Tx,
  input: z.infer<typeof SCHEMA.createEnvironment>,
) => {
  const { metadata } = input;
  const overridePolicyId = await db
    .insert(environmentPolicy)
    .values({ name: input.name, systemId: input.systemId })
    .returning()
    .then(takeFirst)
    .then((policy) => policy.id);
  const policyId = input.policyId ?? overridePolicyId;

  const env = await db
    .insert(environment)
    .values({ ...input, policyId })
    .onConflictDoUpdate({
      target: [environment.name, environment.systemId],
      set: buildConflictUpdateColumns(environment, [
        "description",
        "directory",
        "policyId",
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

  await db
    .update(environmentPolicy)
    .set({ environmentId: env.id })
    .where(eq(environmentPolicy.id, policyId));

  return env;
};
