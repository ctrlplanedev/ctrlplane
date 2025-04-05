import type {
  InsertResource,
  ResourceProviderGoogle,
  Workspace,
} from "@ctrlplane/db/schema";
import type { ClusterManagerClient } from "@google-cloud/container";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import type { KubeConfig } from "@kubernetes/client-node";
import type { AuthClient } from "google-auth-library";
import Container from "@google-cloud/container";
import { CoreV1Api } from "@kubernetes/client-node";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";

import { getGoogleClient } from "./client.js";
import { clusterToResource } from "./cluster-to-resource.js";
import { createNamespaceResource, getKubeConfig } from "./kube.js";
import { getVClustersForCluster } from "./vcluster.js";

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
