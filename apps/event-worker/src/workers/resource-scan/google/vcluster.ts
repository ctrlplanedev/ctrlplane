import { exec as execCallback } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import type { google } from "@google-cloud/container/build/protos/protos";
import type { KubeConfig } from "@kubernetes/client-node";
import { SemVer } from "semver";
import { v4 as uuidv4 } from "uuid";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { clusterToResource } from "./cluster-to-resource.js";

const log = logger.child({ module: "resource-scan/gke/vcluster" });

const exec = promisify(execCallback);

export const getVClustersForCluster = async (
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
