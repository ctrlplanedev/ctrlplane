import type {
  InsertTarget,
  TargetProviderGoogle,
  Workspace,
} from "@ctrlplane/db/schema";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import { CoreV1Api } from "@kubernetes/client-node";
import { cloneDeep, merge } from "lodash-es";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import {
  clusterToTarget,
  connectToCluster,
  getClusters,
  getGoogleClusterClient,
} from "./google.js";

const log = logger.child({ label: "target-scan/gke" });

export const getGkeTargets = async (
  workspace: Workspace,
  config: TargetProviderGoogle,
) => {
  const { googleServiceAccountEmail } = workspace;
  log.info(
    `Scanning ${config.projectIds.join(", ")} using ${googleServiceAccountEmail}`,
    { workspaceId: workspace.id, config, googleServiceAccountEmail },
  );

  let googleClusterClient, impersonatedAuthClient;
  try {
    [googleClusterClient, impersonatedAuthClient] =
      await getGoogleClusterClient(googleServiceAccountEmail);
  } catch (error: any) {
    log.error(`Failed to get Google Cluster Client: ${error.message}`, {
      error,
      workspaceId: workspace.id,
    });
    throw error;
  }

  const clusters = (
    await Promise.allSettled(
      config.projectIds.map(async (project) =>
        getClusters(googleClusterClient, project)
          .then((clusters) => ({ project, clusters }))
          .catch((e) => {
            log.error(
              `Unable to get clusters for project: ${project} - ${e.message}`,
              { error: e, project, workspaceId: workspace.id },
            );
            return { project, clusters: [] };
          }),
      ),
    )
  )
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        project: string;
        clusters: google.container.v1.ICluster[];
      }> => result.status === "fulfilled",
    )
    .map((v) => v.value);

  const kubernetesApiTargets: InsertTarget[] = clusters.flatMap(
    ({ project, clusters }) =>
      clusters.map((cluster) =>
        clusterToTarget(
          workspace.id,
          config.targetProviderId,
          project,
          cluster,
        ),
      ),
  );

  const kubernetesNamespaceTargets = (
    await Promise.all(
      clusters.flatMap(({ project, clusters }) => {
        return clusters.flatMap(async (cluster) => {
          if (cluster.name == null || cluster.location == null) {
            log.warn(`Skipping cluster with missing name or location`, {
              project,
              cluster,
              workspaceId: workspace.id,
            });
            return [];
          }

          let kubeConfig;
          try {
            kubeConfig = await connectToCluster(
              googleClusterClient,
              impersonatedAuthClient,
              project,
              cluster.name,
              cluster.location,
            );
          } catch (error: any) {
            log.error(
              `Failed to connect to cluster: ${cluster.name}/${cluster.id} - ${error.message}`,
              { error, project, cluster, workspaceId: workspace.id },
            );
            return [];
          }

          const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

          try {
            const response = await k8sApi.listNamespace();
            const namespaces = response.body.items;
            const clusterTarget = clusterToTarget(
              workspace.id,
              config.targetProviderId,
              project,
              cluster,
            );
            return namespaces
              .filter((n) => n.metadata?.name != null)
              .map((n) =>
                merge(cloneDeep(clusterTarget), {
                  name: `${cluster.name ?? cluster.id ?? ""}/${n.metadata!.name}`,
                  kind: "Namespace",
                  identifier: `${project}/${cluster.name}/${n.metadata!.name}`,
                  config: { namespace: n.metadata!.name },
                  metadata: {
                    [ReservedMetadataKey.ParentTargetIdentifier]:
                      clusterTarget.identifier,
                    ...n.metadata?.labels,
                    "kubernetes/namespace": n.metadata!.name ?? "",
                  },
                }),
              );
          } catch (error: any) {
            log.error(
              `Unable to list namespaces for cluster: ${cluster.name}/${cluster.id} - ${error.message}`,
              { error, project, cluster, workspaceId: workspace.id },
            );

            return [];
          }
        });
      }),
    )
  ).flat();
  log.info(
    `Found ${kubernetesApiTargets.length} API targets and ${kubernetesNamespaceTargets.length} Namespace targets.`,
  );
  return [...kubernetesApiTargets, ...kubernetesNamespaceTargets];
};
