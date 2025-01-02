import type { ManagedCluster } from "@azure/arm-containerservice";
import { ContainerServiceClient } from "@azure/arm-containerservice";
import { ClientSecretCredential } from "@azure/identity";
import { isPresent } from "ts-is-present";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import { convertManagedClusterToResource } from "./cluster-to-resource.js";

const log = logger.child({ label: "resource-scan/azure" });

const AZURE_CLIENT_ID = process.env.AZURE_APP_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_APP_CLIENT_SECRET;

export const getAksResources = async (
  workspace: SCHEMA.Workspace,
  azureProvider: SCHEMA.ResourceProviderAzure,
) => {
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    log.error("Invalid azure credentials, skipping resource scan");
    return [];
  }

  const tenant = await db
    .select()
    .from(SCHEMA.azureTenant)
    .where(eq(SCHEMA.azureTenant.id, azureProvider.tenantId))
    .then(takeFirstOrNull);

  if (!tenant) {
    log.error("Tenant not found, skipping resource scan");
    return [];
  }

  const credential = new ClientSecretCredential(
    tenant.tenantId,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
  );

  const client = new ContainerServiceClient(
    credential,
    azureProvider.subscriptionId,
  );

  const res = client.managedClusters.list();

  const clusters: ManagedCluster[] = [];
  for await (const cluster of res) {
    clusters.push(cluster);
  }

  const { resourceProviderId: providerId } = azureProvider;
  return clusters
    .map((cluster) =>
      convertManagedClusterToResource(workspace.id, providerId, cluster),
    )
    .filter(isPresent);
};
