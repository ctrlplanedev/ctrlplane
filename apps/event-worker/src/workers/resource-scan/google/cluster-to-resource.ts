import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import { SemVer } from "semver";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { cloudRegionsGeo } from "@ctrlplane/validators/resources";

import { omitNullUndefined } from "../../../utils.js";

export const clusterToResource = (
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
  const { timezone, latitude, longitude } =
    cloudRegionsGeo[cluster.location ?? ""] ?? {};
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
      [ReservedMetadataKey.LocationTimezone]: timezone,
      [ReservedMetadataKey.LocationLatitude]: latitude,
      [ReservedMetadataKey.LocationLongitude]: longitude,

      "google/self-link": cluster.selfLink,
      "google/project": project,
      "google/location": cluster.location,
      "google/autopilot": String(cluster.autopilot?.enabled ?? false),

      [ReservedMetadataKey.KubernetesFlavor]: "gke",
      [ReservedMetadataKey.KubernetesVersion]:
        masterVersion.version.split("-")[0] ?? "",
      [ReservedMetadataKey.KubernetesStatus]:
        cluster.status === "RUNNING"
          ? "running"
          : cluster.status === "PROVISIONING"
            ? "creating"
            : "unknown",
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
