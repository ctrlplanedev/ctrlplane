import type { InsertTarget } from "@ctrlplane/db/schema";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { connectToCluster } from "./google.js";

const log = logger.child({ label: "target-scan/gke/kube" });

export const getKubeConfig = async (
  googleClusterClient: any,
  impersonatedAuthClient: any,
  project: string,
  cluster: google.container.v1.ICluster,
  workspaceId: string,
) => {
  try {
    return connectToCluster(
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

export const createNamespaceTarget = (
  clusterTarget: InsertTarget,
  namespace: any,
  project: string,
  cluster: google.container.v1.ICluster,
) => {
  return _.merge(_.cloneDeep(clusterTarget), {
    name: `${cluster.name ?? cluster.id ?? ""}/${namespace.metadata!.name}`,
    kind: "Namespace",
    identifier: `${project}/${cluster.name}/${namespace.metadata!.name}`,
    config: { namespace: namespace.metadata!.name },
    metadata: {
      [ReservedMetadataKey.ParentTargetIdentifier]: clusterTarget.identifier,
      ...namespace.metadata?.labels,
      "kubernetes/namespace": namespace.metadata!.name ?? "",
    },
  });
};
