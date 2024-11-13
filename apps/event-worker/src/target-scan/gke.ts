import { exec as execCallback } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import type {
  InsertTarget,
  TargetProviderGoogle,
  Workspace,
} from "@ctrlplane/db/schema";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import type { KubeConfig } from "@kubernetes/client-node";
import { CoreV1Api } from "@kubernetes/client-node";
import _ from "lodash";
import { SemVer } from "semver";
import { v4 as uuidv4 } from "uuid";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import {
  clusterToTarget,
  connectToCluster,
  getClient,
  getClusters,
} from "./google.js";
import { createNamespaceTarget } from "./kube.js";

const exec = promisify(execCallback);

const log = logger.child({ label: "target-import/gke" });

const getClustersByProject = async (
  googleClusterClient: any,
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

const getKubeConfig = async (
  googleClusterClient: any,
  impersonatedAuthClient: any,
  project: string,
  cluster: google.container.v1.ICluster,
  workspaceId: string,
) => {
  try {
    return await connectToCluster(
      googleClusterClient,
      impersonatedAuthClient,
      project,
      cluster.name!,
      cluster.location!,
    );
  } catch (error: any) {
    log.error(
      `Failed to connect to cluster: ${cluster.name}/${cluster.id} - ${error.message}`,
      { error, project, cluster, workspaceId },
    );
    return null;
  }
};

const getNamespacesForCluster = async (
  kubeConfig: KubeConfig,
  project: string,
  cluster: google.container.v1.ICluster,
  workspaceId: string,
  targetProviderId: string,
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
    const clusterTarget = clusterToTarget(
      workspaceId,
      targetProviderId,
      project,
      cluster,
    );

    return namespaces
      .filter((n) => n.metadata?.name != null)
      .map((n) => createNamespaceTarget(clusterTarget, n, project, cluster));
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
  targetProviderId: string,
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

    const clusterTarget = clusterToTarget(
      workspaceId,
      targetProviderId,
      project,
      cluster,
    );

    return vclusters.map((vcluster) => {
      const version = new SemVer(vcluster.Version);
      return {
        ...clusterTarget,
        name: `${cluster.name}/${vcluster.Namespace}/${vcluster.Name}`,
        identifier: `${project}/${cluster.name}/${vcluster.Namespace}/${vcluster.Name}`,
        kind: "ClusterAPI",
        config: {
          ...clusterTarget.config,
          name: cluster.name,
          namespace: vcluster.Namespace,
          status: vcluster.Status,
          vcluster: vcluster.Name,
        },
        metadata: {
          ...clusterTarget.metadata,
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

export const getGkeTargets = async (
  workspace: Workspace,
  config: TargetProviderGoogle,
) => {
  const { googleServiceAccountEmail } = workspace;
  log.info(
    `Scanning ${config.projectIds.join(", ")} using ${googleServiceAccountEmail}`,
    { workspaceId: workspace.id, config, googleServiceAccountEmail },
  );

  const { googleClusterClient, impersonatedAuthClient } = await getClient(
    googleServiceAccountEmail,
  );

  const clusters = await getClustersByProject(
    googleClusterClient,
    config.projectIds,
  );

  const targets: InsertTarget[] = [];

  if (config.importGke)
    targets.push(
      ...clusters.flatMap(({ project, clusters }) =>
        clusters.map((cluster) =>
          clusterToTarget(
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
        cluster,
        workspace.id,
      );
      if (kubeConfig == null) return [];

      if (config.importNamespaces)
        targets.push(
          ...(await getNamespacesForCluster(
            kubeConfig,
            project,
            cluster,
            workspace.id,
            config.resourceProviderId,
          )),
        );

      if (config.importVCluster)
        targets.push(
          ...(await getVClustersForCluster(
            kubeConfig,
            project,
            cluster,
            workspace.id,
            config.resourceProviderId,
          )),
        );

      return targets;
    }),
  );

  const targetCounts = _.countBy(targets, (target) =>
    [target.kind, target.version].join("/"),
  );
  log.info(`Found ${targets.length} targets`, {
    targetCounts: Object.entries(targetCounts)
      .map(([key, count]) => `${key}: ${count}`)
      .join(", "),
  });

  return targets;
};
