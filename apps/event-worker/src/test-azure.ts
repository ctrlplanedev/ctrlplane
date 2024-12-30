import type { ManagedCluster } from "@azure/arm-containerservice";
import { ContainerServiceClient } from "@azure/arm-containerservice";
import {
  ClientAssertionCredential,
  ClientSecretCredential,
} from "@azure/identity";

import { logger } from "@ctrlplane/logger";

const AZURE_CLIENT_ID = process.env.AZURE_APP_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_APP_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

export const testAzure = async () => {
  // 1) Basic checks
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    console.error("Azure credentials not found");
    return;
  }

  const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
  );

  const subscriptionId = "636d899d-58b4-4d7b-9e56-7a984388b4c8";

  const client = new ContainerServiceClient(credential, subscriptionId);

  const res = client.managedClusters.list();

  const clusters: ManagedCluster[] = [];
  for await (const cluster of res) {
    console.log(JSON.stringify(cluster, null, 2));
  }

  const clusters2 = await Array.fromAsync(res);

  // console.log(clusters);
};
