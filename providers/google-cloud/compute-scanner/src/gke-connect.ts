import type { ClusterManagerClient } from "@google-cloud/container";
import { KubeConfig } from "@kubernetes/client-node";
import { GoogleAuth } from "google-auth-library";

const sourceCredentials = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export const connectToCluster = async (
  clusterClient: ClusterManagerClient,
  project: string,
  clusterName: string,
  clusterLocation: string,
) => {
  const [credentials] = await clusterClient.getCluster({
    name: `projects/${project}/locations/${clusterLocation}/clusters/${clusterName}`,
  });
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromOptions({
    clusters: [
      {
        name: clusterName,
        server: `https://${credentials.endpoint}`,
        caData: credentials.masterAuth!.clusterCaCertificate!,
      },
    ],
    users: [
      {
        name: clusterName,
        token: (await sourceCredentials.getAccessToken())!,
      },
    ],
    contexts: [
      {
        name: clusterName,
        user: clusterName,
        cluster: clusterName,
      },
    ],
    currentContext: clusterName,
  });
  return kubeConfig;
};
