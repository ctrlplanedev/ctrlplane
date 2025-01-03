import { randomUUID } from "crypto";
import type { ResourceScanEvent } from "@ctrlplane/validators/events";
import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import IORedis from "ioredis";
import ms from "ms";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Channel } from "@ctrlplane/validators/events";

import { env } from "~/env";

type Params = {
  workspaceId: string;
  tenantId: string;
  subscriptionId: string;
  name: string;
};

const baseUrl = env.BASE_URL;
const clientId = env.AZURE_APP_CLIENT_ID;

const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const resourceScanQueue = new Queue<ResourceScanEvent>(Channel.ResourceScan, {
  connection: redis,
});

export const GET = async (_: never, { params }: { params: Params }) => {
  const { workspaceId, tenantId, subscriptionId, name } = params;
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
      .select()
      .from(SCHEMA.azureTenant)
      .where(eq(SCHEMA.azureTenant.tenantId, tenantId))
      .then(takeFirstOrNull);

    if (tenant == null) {
      const state = randomUUID();
      const config = { workspaceId, tenantId, subscriptionId, name };
      const configJSON = JSON.stringify(config);
      await redis.set(`azure_consent_state:${state}`, configJSON, "EX", 900);
      const redirectUrl = `${baseUrl}/api/azure/consent?state=${state}`;
      const consentUrl = `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${clientId}&redirect_uri=${redirectUrl}`;
      return NextResponse.redirect(consentUrl);
    }

    if (tenant.workspaceId !== workspaceId)
      return NextResponse.json(
        { error: "Tenant does not belong to this workspace" },
        { status: FORBIDDEN },
      );

    const resourceProvider = await db
      .insert(SCHEMA.resourceProvider)
      .values({
        workspaceId,
        name,
      })
      .returning()
      .then(takeFirstOrNull);

    if (resourceProvider == null)
      return NextResponse.json(
        { error: "Failed to create resource provider" },
        { status: INTERNAL_SERVER_ERROR },
      );

    try {
      await db.insert(SCHEMA.resourceProviderAzure).values({
        resourceProviderId: resourceProvider.id,
        tenantId: tenant.id,
        subscriptionId,
      });

      await resourceScanQueue.add(
        resourceProvider.id,
        { resourceProviderId: resourceProvider.id },
        { repeat: { every: ms("10m"), immediately: true } },
      );
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Failed to create resource provider Azure" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/${workspace.slug}/resource-providers`,
    );
  });
};
