import { DescribeClusterCommand, EKSClient } from "@aws-sdk/client-eks";
import { fromSSO } from "@aws-sdk/credential-providers";
import { KubeConfig } from "@kubernetes/client-node";

import { env } from "./config.js";

export const createEksClient = (region: string) => {
  const isGoogleCloud = process.env.GOOGLE_CLOUD_PROJECT;

  return new EKSClient({
    region,
    credentials: isGoogleCloud
      ? undefined
      : fromSSO({ profile: env.AWS_PROFILE }),
  });
};

export const connectToCluster = async (clusterName: string, region: string) => {
  const eksClient = createEksClient(region);

  const response = await eksClient.send(
    new DescribeClusterCommand({ name: clusterName }),
  );

  if (response.cluster == null)
    throw new Error(`Cluster ${clusterName} not found`);

  const kubeConfig = new KubeConfig();

  kubeConfig.loadFromOptions({
    clusters: [
      {
        name: clusterName,
        server: response.cluster.endpoint!,
        caData: response.cluster.certificateAuthority?.data,
      },
    ],
    users: [
      {
        name: `${clusterName}-user`,
        exec: {
          apiVersion: "client.authentication.k8s.io/v1",
          command: "aws",
          args: [
            "eks",
            "get-token",
            "--cluster-name",
            clusterName,
            "--region",
            region,
            "--profile",
            env.AWS_PROFILE,
          ],
          env: [
            {
              name: "AWS_SDK_LOAD_CONFIG",
              value: "1",
            },
          ],
          interactiveMode: "Never",
        },
      },
    ],
    contexts: [
      {
        name: `${clusterName}-context`,
        user: `${clusterName}-user`,
        cluster: clusterName,
      },
    ],
    currentContext: `${clusterName}-context`,
  });

  return kubeConfig;
};
