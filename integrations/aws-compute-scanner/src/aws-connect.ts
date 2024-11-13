import type { ClusterManagerClient } from "@google-cloud/container";
import { EKSClient } from "@aws-sdk/client-eks";
import { fromIni } from "@aws-sdk/credential-providers";
import { KubeConfig } from "@kubernetes/client-node";

import { env } from "./config.js";

export const createEksClient = () => {
  const isGoogleCloud =
    process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_REGION;

  console.log("A");

  try {
    const client: EKSClient = new EKSClient({
      region: env.AWS_REGION,
      credentials: isGoogleCloud
        ? undefined
        : fromIni({ profile: "AWSAdministratorAccess-770934259321" }),
    });
    return client;
  } catch (error) {
    console.log("b");
    console.error("Failed to create EKS client:", error);
    throw error;
  }
};

// export const connectToCluster = async (
//   clusterClient: ClusterManagerClient,
//   project: string,
//   clusterName: string,
//   clusterLocation: string,
// ) => {
//   const [credentials] = await clusterClient.getCluster({
//     name: `projects/${project}/locations/${clusterLocation}/clusters/${clusterName}`,
//   });
//   const kubeConfig = new KubeConfig();
//   kubeConfig.loadFromOptions({
//     clusters: [
//       {
//         name: clusterName,
//         server: `https://${credentials.endpoint}`,
//         caData: credentials.masterAuth!.clusterCaCertificate!,
//       },
//     ],
//     users: [
//       {
//         name: clusterName,
//         token: (await sourceCredentials.getAccessToken())!,
//       },
//     ],
//     contexts: [
//       {
//         name: clusterName,
//         user: clusterName,
//         cluster: clusterName,
//       },
//     ],
//     currentContext: clusterName,
//   });
//   return kubeConfig;
// };
