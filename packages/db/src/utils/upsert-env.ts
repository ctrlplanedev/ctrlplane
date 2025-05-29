import type { z } from "zod";
import { eq } from "drizzle-orm";

import type { Tx } from "../common.js";
import { buildConflictUpdateColumns, takeFirst } from "../common.js";
import * as SCHEMA from "../schema/index.js";
import { environment, environmentPolicy } from "../schema/index.js";

const upsertVersionChannels = (
  db: Tx,
  policyId: string,
  deploymentVersionChannels: { channelId: string; deploymentId: string }[],
) =>
  db
    .insert(SCHEMA.environmentPolicyDeploymentVersionChannel)
    .values(
      deploymentVersionChannels.map(({ channelId, deploymentId }) => ({
        policyId,
        channelId,
        deploymentId,
      })),
    )
    .onConflictDoUpdate({
      target: [
        SCHEMA.environmentPolicyDeploymentVersionChannel.policyId,
        SCHEMA.environmentPolicyDeploymentVersionChannel.deploymentId,
      ],
      set: buildConflictUpdateColumns(
        SCHEMA.environmentPolicyDeploymentVersionChannel,
        ["channelId"],
      ),
    });

export const upsertEnv = async (
  db: Tx,
  input: z.infer<typeof SCHEMA.createEnvironment>,
) => {
  const { metadata, versionChannels } = input;
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

  if (versionChannels != null && versionChannels.length > 0)
    await upsertVersionChannels(db, policyId, versionChannels);

  await db
    .update(environmentPolicy)
    .set({ environmentId: env.id })
    .where(eq(environmentPolicy.id, policyId));

  return env;
};
