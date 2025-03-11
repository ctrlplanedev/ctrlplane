import type { ManagedCluster } from "@azure/arm-containerservice";
import { ContainerServiceClient } from "@azure/arm-containerservice";
import { ClientSecretCredential } from "@azure/identity";
import { isPresent } from "ts-is-present";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";

import { env } from "../../config.js";
import { convertManagedClusterToResource } from "./cluster-to-resource.js";

const AZURE_CLIENT_ID = env.AZURE_APP_CLIENT_ID;
const AZURE_CLIENT_SECRET = env.AZURE_APP_CLIENT_SECRET;

export const getAksResources = async (
  workspace: SCHEMA.Workspace,
  azureProvider: SCHEMA.ResourceProviderAzure,
) => {
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET)
    throw new Error("Invalid azure credentials");

  const tenant = await db
    .select()
    .from(SCHEMA.azureTenant)
    .where(eq(SCHEMA.azureTenant.id, azureProvider.tenantId))
    .then(takeFirstOrNull);

  if (!tenant) throw new Error("Tenant not found");

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

  const resourcePromises = clusters.map((cluster) =>
    convertManagedClusterToResource(
      workspace.id,
      azureProvider,
      cluster,
      client,
    ),
  );
  const resources = await Promise.all(resourcePromises);
  return resources.filter(isPresent);
};
