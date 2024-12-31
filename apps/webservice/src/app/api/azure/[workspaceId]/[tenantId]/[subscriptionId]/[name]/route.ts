import type { ResourceScanEvent } from "@ctrlplane/validators/events";
import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import IORedis from "ioredis";
import * as LZString from "lz-string";
import ms from "ms";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
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

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const resourceScanQueue = new Queue<ResourceScanEvent>(Channel.ResourceScan, {
  connection,
});

export const GET = async ({ params }: { params: Params }) => {
  const { workspaceId, tenantId, subscriptionId, name } = params;

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
    const configHash = LZString.compressToEncodedURIComponent(
      JSON.stringify({ workspaceId, tenantId, subscriptionId, name }),
    );
    const redirectUrl = `${baseUrl}/api/azure/consent?config=${configHash}`;
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

  db.insert(SCHEMA.resourceProviderAzure)
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
      NextResponse.redirect(`${baseUrl}/${workspace.slug}/resource-providers`),
    )
    .catch(() =>
      NextResponse.json(
        { error: "Failed to create resource provider" },
        { status: INTERNAL_SERVER_ERROR },
      ),
    );
};