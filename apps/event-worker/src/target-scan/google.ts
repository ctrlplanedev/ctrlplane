import type { ClusterManagerClient } from "@google-cloud/container";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import Container from "@google-cloud/container";
import { KubeConfig } from "@kubernetes/client-node";
import { GoogleAuth, Impersonated } from "google-auth-library";
import { SemVer } from "semver";

import { omitNullUndefined } from "../utils.js";

const sourceCredentials = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export const getGoogleClusterClient = async (
  targetPrincipal?: string | null,
) => {
  const clientOptions: { authClient?: Impersonated } = {};

  if (targetPrincipal !== null)
    clientOptions.authClient = new Impersonated({
      sourceClient: await sourceCredentials.getClient(),
      targetPrincipal: targetPrincipal ?? undefined,
      lifetime: 3600,
      delegates: [],
      targetScopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

  return new Container.v1.ClusterManagerClient(clientOptions);
};

export const getClusters = async (
  clusterClient: ClusterManagerClient,
  projectId: string,
) => {
  const request = { parent: `projects/${projectId}/locations/-` };
  const [response] = await clusterClient.listClusters(request);
  const { clusters } = response;
  return clusters ?? [];
};

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

export const clusterToTarget = (
  workspaceId: string,
  providerId: string,
  project: string,
  cluster: google.container.v1.ICluster,
) => {
  const masterVersion = new SemVer(cluster.currentMasterVersion ?? "0");
  const nodeVersion = new SemVer(cluster.currentNodeVersion ?? "0");
  const autoscaling = String(
    cluster.autoscaling?.enableNodeAutoprovisioning ?? false,
  );

  const appUrl = `https://console.cloud.google.com/kubernetes/clusters/details/${cluster.location}/${cluster.name}/details?project=${project}`;
  return {
    workspaceId,
    name: cluster.name ?? cluster.id ?? "",
    providerId,
    identifier: `${project}/${cluster.name}`,
    version: "kubernetes/v1",
    kind: "KubernetesAPI",
    config: {
      name: cluster.name,
      status: cluster.status,
      cluster: {
        certificateAuthorityData: cluster.masterAuth?.clusterCaCertificate,
        endpoint: `https://${cluster.endpoint}`,
      },
    },
    labels: omitNullUndefined({
      "ctrlplane/url": appUrl,

      "google/self-link": cluster.selfLink,
      "google/project": project,
      "google/location": cluster.location,
      "google/autopilot": cluster.autopilot?.enabled,

      "kubernetes/cluster-name": cluster.name,
      "kubernetes/cluster-id": cluster.id,
      "kubernetes/distribution": "gke",
      "kubernetes/status": cluster.status,
      "kubernetes/node-count": String(cluster.currentNodeCount ?? "unknown"),

      "kubernetes/master-version": masterVersion.version,
      "kubernetes/master-version-major": String(masterVersion.major),
      "kubernetes/master-version-minor": String(masterVersion.minor),
      "kubernetes/master-version-patch": String(masterVersion.patch),

      "kubernetes/node-version": nodeVersion.version,
      "kubernetes/node-version-major": String(nodeVersion.major),
      "kubernetes/node-version-minor": String(nodeVersion.minor),
      "kubernetes/node-version-patch": String(nodeVersion.patch),

      "kubernetes/autoscaling-enabled": autoscaling,

      ...(cluster.resourceLabels ?? {}),
    }),
  };
};
