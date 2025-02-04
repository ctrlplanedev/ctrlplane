import type { ResourceScanEvent } from "@ctrlplane/validators/events";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import IORedis from "ioredis";
import ms from "ms";
import { z } from "zod";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";

import { env } from "~/env";

const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const resourceScanQueue = new Queue<ResourceScanEvent>(Channel.ResourceScan, {
  connection: redis,
});

const configSchema = z.object({
  workspaceId: z.string(),
  tenantId: z.string(),
  subscriptionId: z.string(),
  name: z.string(),
});

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");
  const resourceProviderId = searchParams.get("resourceProviderId");
  if (!state)
    return NextResponse.json({ error: "Bad request" }, { status: BAD_REQUEST });

  const redisKey = `azure_consent_state:${state}`;
  const configJSON = await redis.get(redisKey);
  if (configJSON == null)
    return NextResponse.json({ error: "Bad request" }, { status: BAD_REQUEST });
  await redis.del(redisKey);

  const config = JSON.parse(configJSON);
  const parsedConfig = configSchema.safeParse(config);
  if (!parsedConfig.success)
    return NextResponse.json({ error: "Bad request" }, { status: BAD_REQUEST });

  const { workspaceId, tenantId, subscriptionId, name } = parsedConfig.data;

  return db.transaction(async (db) => {
    const workspace = await db
      .select()
      .from(SCHEMA.workspace)
      .where(eq(SCHEMA.workspace.id, workspaceId))
      .then(takeFirstOrNull);

    if (workspace == null)
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: NOT_FOUND },
      );

    const tenant = await db
      .insert(SCHEMA.azureTenant)
      .values({ workspaceId, tenantId })
      .returning()
      .then(takeFirstOrNull);

    if (tenant == null)
      return NextResponse.json(
        { error: "Failed to create tenant" },
        { status: INTERNAL_SERVER_ERROR },
      );

    const nextStepsUrl = `${env.BASE_URL}/${workspace.slug}/resource-providers/integrations/azure/${resourceProviderId}`;

    if (resourceProviderId != null)
      return db
        .update(SCHEMA.resourceProviderAzure)
        .set({ tenantId, subscriptionId })
        .where(
          eq(
            SCHEMA.resourceProviderAzure.resourceProviderId,
            resourceProviderId,
          ),
        )
        .then(() => NextResponse.redirect(nextStepsUrl))
        .catch(() =>
          NextResponse.json(
            { error: "Failed to update resource provider" },
            { status: INTERNAL_SERVER_ERROR },
          ),
        );

    const resourceProvider = await db
      .insert(SCHEMA.resourceProvider)
      .values({ workspaceId, name })
      .returning()
      .then(takeFirstOrNull);

    if (resourceProvider == null)
      return NextResponse.json(
        { error: "Failed to create resource provider" },
        { status: INTERNAL_SERVER_ERROR },
      );

    return db
      .insert(SCHEMA.resourceProviderAzure)
      .values({
        resourceProviderId: resourceProvider.id,
        tenantId: tenant.id,
        subscriptionId,
      })
      .then(() =>
        resourceScanQueue.add(
          resourceProvider.id,
          { resourceProviderId: resourceProvider.id },
          { repeat: { every: ms("10m"), immediately: true } },
        ),
      )
      .then(() =>
        NextResponse.redirect(
          `${env.BASE_URL}/${workspace.slug}/resource-providers/integrations/azure/${resourceProvider.id}`,
        ),
      )
      .catch(() =>
        NextResponse.json(
          { error: "Failed to create resource provider" },
          { status: INTERNAL_SERVER_ERROR },
        ),
      );
  });
};
