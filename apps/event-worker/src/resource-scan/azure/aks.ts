import type { ManagedCluster } from "@azure/arm-containerservice";
import type * as SCHEMA from "@ctrlplane/db/schema";
import { ContainerServiceClient } from "@azure/arm-containerservice";
import { ClientSecretCredential } from "@azure/identity";

import { logger } from "@ctrlplane/logger";

import { convertManagedClusterToResource } from "./cluster-to-resource.js";

const log = logger.child({ label: "resource-scan/azure/aks" });

const AZURE_CLIENT_ID = process.env.AZURE_APP_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_APP_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

const getAksResourcesForSubscription = async (
  subscriptionId: string,
  credential: ClientSecretCredential,
  workspaceId: string,
  providerId: string,
) => {
  const client = new ContainerServiceClient(credential, subscriptionId);

  const res = client.managedClusters.list();

  const clusters: ManagedCluster[] = [];
  for await (const cluster of res) {
    clusters.push(cluster);
  }

  return clusters.map((cluster) =>
    convertManagedClusterToResource(workspaceId, providerId, cluster),
  );
};

export const getAksResources = async (
  workspace: SCHEMA.Workspace,
  azureProvider: SCHEMA.ResourceProviderAzure,
) => {
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    log.error("Invalid azure credentials, skipping resource scan");
    return [];
  }

  const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
  );

  const { subscriptionIds } = azureProvider;

  return Promise.allSettled(
    subscriptionIds.map((subscriptionId) =>
      getAksResourcesForSubscription(
        subscriptionId,
        credential,
        workspace.id,
        azureProvider.id,
      ),
    ),
  ).then((results) =>
    results
      .map((result) => (result.status === "fulfilled" ? result.value : []))
      .flat(),
  );
};
