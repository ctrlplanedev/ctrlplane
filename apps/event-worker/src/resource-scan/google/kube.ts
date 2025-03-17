import type { InsertResource } from "@ctrlplane/db/schema";
import type { ClusterManagerClient } from "@google-cloud/container";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import type { AuthClient } from "google-auth-library";
import { KubeConfig } from "@kubernetes/client-node";
import _ from "lodash";

import { sourceCredentials } from "./client.js";

export const getKubeConfig = async (
  clusterClient: ClusterManagerClient,
  authClient: AuthClient | undefined,
  project: string,
  clusterName: string,
  clusterLocation: string,
) => {
  const [credentials] = await clusterClient.getCluster({
    name: `projects/${project}/locations/${clusterLocation}/clusters/${clusterName}`,
  });

  const token = await (authClient != null
    ? authClient.getAccessToken().then((t) => t.token)
    : sourceCredentials.getAccessToken());
  if (token == null) throw new Error("Unable to get kubernetes access token.");

  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromOptions({
    clusters: [
      {
        name: clusterName,
        server: `https://${credentials.endpoint}`,
        caData: credentials.masterAuth!.clusterCaCertificate!,
      },
    ],
    users: [{ name: clusterName, token }],
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

type Namespace = {
  metadata?: {
    name?: string;
    labels?: Record<string, string>;
  };
};

export const createNamespaceResource = (
  clusterResource: InsertResource,
  namespace: Namespace,
  project: string,
  cluster: google.container.v1.ICluster,
) => {
  return _.merge(_.cloneDeep(clusterResource), {
    name: `${cluster.name ?? cluster.id ?? ""}/${namespace.metadata!.name}`,
    kind: "Namespace",
    identifier: `${project}/${cluster.name}/${namespace.metadata!.name}`,
    config: { namespace: namespace.metadata!.name },
    metadata: {
      ...namespace.metadata?.labels,
      "kubernetes/namespace": namespace.metadata!.name ?? "",
    },
  });
};
