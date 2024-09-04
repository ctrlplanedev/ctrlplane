import type { TargetProviderGoogle, Workspace } from "@ctrlplane/db/schema";
import { CoreV1Api } from "@kubernetes/client-node";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";

import type { UpsertTarget } from "./upsert.js";
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
    `Scaning ${config.projectIds.join(", ")} using ${googleServiceAccountEmail}`,
    { workspaceId: workspace.id, config, googleServiceAccountEmail },
  );
  const googleClusterClient = await getGoogleClusterClient(
    googleServiceAccountEmail,
  );

  const clusters = (
    await Promise.allSettled(
      config.projectIds.map(async (project) =>
        getClusters(googleClusterClient, project)
          .then((clusters) => ({ project, clusters }))
          .catch((e) => {
            log.error(
              `Unable to get clusters for project: ${project} - ${String(e)}`,
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
        clusters: any[];
      }> => result.status === "fulfilled",
    )
    .map((v) => v.value);

  const kubernetesApiTargets: UpsertTarget[] = clusters.flatMap(
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
          if (cluster.name == null || cluster.location == null) return [];

          const kubeConfig = await connectToCluster(
            googleClusterClient,
            project,
            cluster.name,
            cluster.location,
          );

          const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

          try {
            const response = await k8sApi.listNamespace();
            const namespaces = response.body.items;
            return namespaces
              .filter((n) => n.metadata != null)
              .map((n) =>
                _.merge(
                  clusterToTarget(
                    workspace.id,
                    config.targetProviderId,
                    project,
                    cluster,
                  ),
                  {
                    name: `${cluster.name ?? cluster.id ?? ""}/${n.metadata!.name}`,
                    kind: "KubernetesNamespace",
                    identifier: `${project}/${cluster.name}/${n.metadata!.name}`,
                    config: {
                      namespace: n.metadata!.name,
                    },
                    labels: {
                      ...n.metadata?.labels,
                      "kubernetes/namespace": n.metadata!.name,
                    },
                  },
                ),
              );
          } catch (e) {
            log.error(
              `Unable to connect to cluster: ${cluster.name}/${cluster.id} - ${String(e)}`,
            );
            return [];
          }
        });
      }),
    )
  ).flat();

  return [...kubernetesApiTargets, ...kubernetesNamespaceTargets];
};
