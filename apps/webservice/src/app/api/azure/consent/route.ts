import type { ResourceScanEvent } from "@ctrlplane/validators/events";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import IORedis from "ioredis";
import * as LZString from "lz-string";
import ms from "ms";
import { z } from "zod";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";

import { env } from "~/env";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const resourceScanQueue = new Queue<ResourceScanEvent>(Channel.ResourceScan, {
  connection,
});

const configSchema = z.object({
  workspaceId: z.string(),
  tenantId: z.string(),
  subscriptionId: z.string(),
  name: z.string(),
});

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const config = searchParams.get("config");

  if (!config) return NextResponse.json({ status: BAD_REQUEST });

  const decodedConfig = LZString.decompressFromEncodedURIComponent(config);
  const parsedConfig = configSchema.safeParse(JSON.parse(decodedConfig));

  if (!parsedConfig.success) return NextResponse.json({ status: BAD_REQUEST });

  const { workspaceId, tenantId, subscriptionId, name } = parsedConfig.data;

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

  const resourceProviderId = resourceProvider.id;
  await db
    .insert(SCHEMA.resourceProviderAzure)
    .values({ resourceProviderId, tenantId, subscriptionId })
    .then(() =>
      resourceScanQueue.add(
        resourceProviderId,
        { resourceProviderId },
        { repeat: { every: ms("10m"), immediately: true } },
      ),
    )
    .then(() =>
      NextResponse.redirect(
        `${env.BASE_URL}/${workspace.slug}/resource-providers`,
      ),
    )
    .catch(() =>
      NextResponse.json(
        { error: "Failed to create resource provider" },
        { status: INTERNAL_SERVER_ERROR },
      ),
    );
};
