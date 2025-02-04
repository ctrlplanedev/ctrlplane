import type { z } from "zod";
import { eq } from "drizzle-orm";

import type { Tx } from "./common.js";
import { takeFirst } from "./common.js";
import * as SCHEMA from "./schema/index.js";
import { environment, environmentPolicy } from "./schema/index.js";

const createReleaseChannels = (
  db: Tx,
  policyId: string,
  releaseChannels: { channelId: string; deploymentId: string }[],
) =>
  db.insert(SCHEMA.environmentPolicyReleaseChannel).values(
    releaseChannels.map(({ channelId, deploymentId }) => ({
      policyId,
      channelId,
      deploymentId,
    })),
  );

export const createEnv = async (
  db: Tx,
  input: z.infer<typeof SCHEMA.createEnvironment>,
  metadata?: Record<string, string>,
  releaseChannels?: { channelId: string; deploymentId: string }[],
) => {
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

  if (releaseChannels != null && releaseChannels.length > 0)
    await createReleaseChannels(db, policyId, releaseChannels);

  await db
    .update(environmentPolicy)
    .set({ environmentId: env.id })
    .where(eq(environmentPolicy.id, policyId));

  return env;
};
