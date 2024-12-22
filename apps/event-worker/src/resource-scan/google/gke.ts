import { exec as execCallback } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import type {
  InsertResource,
  ResourceProviderGoogle,
  Workspace,
} from "@ctrlplane/db/schema";
import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import type { ClusterManagerClient } from "@google-cloud/container";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import type { KubeConfig } from "@kubernetes/client-node";
import type { AuthClient } from "google-auth-library";
import Container from "@google-cloud/container";
import { CoreV1Api } from "@kubernetes/client-node";
import _ from "lodash";
import { SemVer } from "semver";
import { v4 as uuidv4 } from "uuid";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { omitNullUndefined } from "../../utils.js";
import { getGoogleClient } from "./client.js";
import { createNamespaceResource, getKubeConfig } from "./kube.js";

const exec = promisify(execCallback);

const log = logger.child({ label: "resource-scan/gke" });

const getClusterClient = async (
  targetPrincipal?: string | null,
): Promise<[ClusterManagerClient, AuthClient | undefined]> => {
  return getGoogleClient(
    Container.v1.ClusterManagerClient,
    targetPrincipal,
    "GKE Cluster Client",
  );
};

const getClusters = async (
  clusterClient: ClusterManagerClient,
  projectId: string,
) => {
  const request = { parent: `projects/${projectId}/locations/-` };
  const [response] = await clusterClient.listClusters(request);
  const { clusters } = response;
  return clusters ?? [];
};

const getClustersByProject = async (
  googleClusterClient: ClusterManagerClient,
  projectIds: string[],
) => {
  const results = await Promise.allSettled(
    projectIds.map(async (project) =>
      getClusters(googleClusterClient, project)
        .then((clusters) => ({ project, clusters }))
        .catch((e: any) => {
          const isPermissionError =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            e.message?.includes("PERMISSION_DENIED") || e.code === 403;
          log.error(
            `Unable to get clusters for project: ${project} - ${
              isPermissionError
                ? 'Missing required permissions. Please ensure the service account has the "Service Account Token Creator" and "GKE Cluster Viewer" roles.'
                : e.message
            }`,
            { error: e, project },
          );
          return { project, clusters: [] };
        }),
    ),
  );

  return results
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        project: string;
        clusters: google.container.v1.ICluster[];
      }> => result.status === "fulfilled",
    )
    .map((v) => v.value);
};

const getNamespacesForCluster = async (
  kubeConfig: KubeConfig,
  project: string,
  cluster: google.container.v1.ICluster,
  workspaceId: string,
  resourceProviderId: string,
) => {
  if (cluster.name == null || cluster.location == null) {
    log.warn(`Skipping cluster with missing name or location`, {
      project,
      cluster,
      workspaceId,
    });
    return [];
  }

  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

  try {
    const response = await k8sApi.listNamespace();
    const namespaces = response.body.items;
    const clusterResource = clusterToResource(
      workspaceId,
      resourceProviderId,
      project,
      cluster,
    );

    return namespaces
      .filter((n) => n.metadata?.name != null)
      .map((n) =>
        createNamespaceResource(clusterResource, n, project, cluster),
      );
  } catch (error: any) {
    log.error(
      `Unable to list namespaces for cluster: ${cluster.name}/${cluster.id} - ${error.message}`,
      { error, project, cluster, workspaceId },
    );
    return [];
  }
};

const getVClustersForCluster = async (
  kubeConfig: KubeConfig,
  project: string,
  cluster: google.container.v1.ICluster,
  workspaceId: string,
  resourceProviderId: string,
) => {
  if (cluster.name == null || cluster.location == null) {
    log.warn(`Skipping cluster with missing name or location`, {
      project,
      cluster,
      workspaceId,
    });
    return [];
  }

  const kubeconfigPath = `/tmp/kubeconfig-${uuidv4()}`;
  try {
    await fs.promises.writeFile(kubeconfigPath, kubeConfig.exportConfig());
    const { stdout } = await exec(
      `KUBECONFIG=${kubeconfigPath} vcluster list --output=json`,
    );
    await fs.promises.unlink(kubeconfigPath);

    const vclusters = JSON.parse(stdout) as Array<{
      Name: string;
      Namespace: string;
      Status: string;
      Created: string;
      Version: string;
    }> | null;

    if (vclusters == null) {
      log.info(
        `No vclusters found for cluster: ${cluster.name}/${cluster.id}`,
        { project, clusterName: cluster.name, workspaceId },
      );
      return [];
    }

    const clusterResource = clusterToResource(
      workspaceId,
      resourceProviderId,
      project,
      cluster,
    );

    return vclusters.map((vcluster) => {
      const version = new SemVer(vcluster.Version);
      return {
        ...clusterResource,
        name: `${cluster.name}/${vcluster.Namespace}/${vcluster.Name}`,
        identifier: `${project}/${cluster.name}/${vcluster.Namespace}/${vcluster.Name}`,
        kind: "ClusterAPI",
        config: {
          ...clusterResource.config,
          name: cluster.name,
          namespace: vcluster.Namespace,
          status: vcluster.Status,
          vcluster: vcluster.Name,
        },
        metadata: {
          ...clusterResource.metadata,
          "vcluster/version": vcluster.Version,
          "vcluster/version-major": String(version.major),
          "vcluster/version-minor": String(version.minor),
          "vcluster/version-patch": String(version.patch),
          "vcluster/name": vcluster.Name,
          "vcluster/namespace": vcluster.Namespace,
          "vcluster/status": vcluster.Status,
          "vcluster/created": vcluster.Created,
          [ReservedMetadataKey.KubernetesFlavor]: "vcluster",
        },
      };
    });
  } catch (error: any) {
    log.error(
      `Unable to list vclusters for cluster: ${cluster.name}/${cluster.id} - ${error.message}`,
      { error, project, cluster, workspaceId },
    );
    return [];
  }
};

const clusterToResource = (
  workspaceId: string,
  providerId: string,
  project: string,
  cluster: google.container.v1.ICluster,
): KubernetesClusterAPIV1 & { workspaceId: string; providerId: string } => {
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
    kind: "ClusterAPI",
    config: {
      name: cluster.name!,
      auth: {
        method: "google/gke",
        project,
        location: cluster.location!,
        clusterName: cluster.name!,
      },
      status: cluster.status?.toString() ?? "STATUS_UNSPECIFIED",
      server: {
        certificateAuthorityData: cluster.masterAuth?.clusterCaCertificate,
        endpoint: `https://${cluster.endpoint}`,
      },
    },
    metadata: omitNullUndefined({
      [ReservedMetadataKey.Links]: JSON.stringify({ "Google Console": appUrl }),
      [ReservedMetadataKey.ExternalId]: cluster.id ?? "",

      "google/self-link": cluster.selfLink,
      "google/project": project,
      "google/location": cluster.location,
      "google/autopilot": String(cluster.autopilot?.enabled ?? false),

      [ReservedMetadataKey.KubernetesFlavor]: "gke",
      [ReservedMetadataKey.KubernetesVersion]:
        masterVersion.version.split("-")[0] ?? "",

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

export const getGkeResources = async (
  workspace: Workspace,
  config: ResourceProviderGoogle,
) => {
  const { googleServiceAccountEmail } = workspace;
  log.info(
    `Scanning ${config.projectIds.join(", ")} using ${googleServiceAccountEmail}`,
    { workspaceId: workspace.id, config, googleServiceAccountEmail },
  );

  const [googleClusterClient, impersonatedAuthClient] = await getClusterClient(
    googleServiceAccountEmail,
  );

  const clusters = await getClustersByProject(
    googleClusterClient,
    config.projectIds,
  );

  const resources: InsertResource[] = [];

  if (config.importGke)
    resources.push(
      ...clusters.flatMap(({ project, clusters }) =>
        clusters.map((cluster) =>
          clusterToResource(
            workspace.id,
            config.resourceProviderId,
            project,
            cluster,
          ),
        ),
      ),
    );

  const clustersWithProject = clusters
    .map(({ project, clusters }) =>
      clusters.map((cluster) => ({ project, cluster })),
    )
    .flat();

  await Promise.all(
    clustersWithProject.map(async ({ project, cluster }) => {
      const kubeConfig = await getKubeConfig(
        googleClusterClient,
        impersonatedAuthClient,
        project,
        cluster.name!,
        cluster.location!,
      ).catch((e) => {
        log.error(
          `Failed to connect to cluster: ${cluster.name}/${cluster.id} - ${e.message}`,
          { error: e, project, cluster, workspaceId: workspace.id },
        );
        return null;
      });
      if (kubeConfig == null) return [];

      if (config.importNamespaces)
        resources.push(
          ...(await getNamespacesForCluster(
            kubeConfig,
            project,
            cluster,
            workspace.id,
            config.resourceProviderId,
          )),
        );

      if (config.importVCluster)
        resources.push(
          ...(await getVClustersForCluster(
            kubeConfig,
            project,
            cluster,
            workspace.id,
            config.resourceProviderId,
          )),
        );

      return resources;
    }),
  );

  const resourceCounts = _.countBy(resources, (resource) =>
    [resource.kind, resource.version].join("/"),
  );
  log.info(`Found ${resources.length} resources`, {
    resourceCounts: Object.entries(resourceCounts)
      .map(([key, count]) => `${key}: ${count}`)
      .join(", "),
  });

  return resources;
};
