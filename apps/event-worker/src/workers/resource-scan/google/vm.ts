import type * as SCHEMA from "@ctrlplane/db/schema";
import type { InstanceV1 } from "@ctrlplane/validators/resources";
import type { google } from "@google-cloud/compute/build/protos/protos.js";
import { InstancesClient } from "@google-cloud/compute";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { omitNullUndefined } from "../../../utils/omit-null-undefined.js";
import { getGoogleClient } from "./client.js";

const log = logger.child({ module: "resource-scan/gke/vm" });

const getVMClient = (targetPrincipal?: string | null) =>
  getGoogleClient(InstancesClient, targetPrincipal, "VM Client");

const getFlattenedMetadata = (metadata?: google.cloud.compute.v1.IMetadata) => {
  if (metadata == null) return {};
  const { items } = metadata;
  return _.fromPairs(
    items?.map(({ key, value }) => [`vm/metadata/${key}`, value ?? ""]) ?? [],
  );
};

const getFlattenedTags = (tags?: google.cloud.compute.v1.ITags) => {
  if (tags == null) return {};
  const { items } = tags;
  return _.fromPairs(items?.map((value) => [`vm/tag/${value}`, true]) ?? []);
};

const instanceToResource = (
  instance: google.cloud.compute.v1.IInstance,
  workspaceId: string,
  providerId: string,
  projectId: string,
): InstanceV1 => {
  const instanceZone =
    instance.zone != null ? instance.zone.split("/").pop() : null;
  const appUrl = `https://console.cloud.google.com/compute/instancesDetail/zones/${instanceZone}/instances/${instance.name}?project=${projectId}`;
  return {
    workspaceId,
    name: String(instance.name ?? instance.id ?? ""),
    providerId,
    identifier: `${projectId}/${instance.name}`,
    version: "compute/v1",
    kind: "Instance",
    config: {
      name: String(instance.name ?? instance.id ?? ""),
      id: String(instance.id ?? ""),
      connectionMethod: {
        type: "gcp",
        project: projectId,
        instanceName: String(instance.name ?? instance.id ?? ""),
        zone: instanceZone ?? "",
        username: instance.serviceAccounts?.[0]?.email ?? "",
      },
    },
    metadata: omitNullUndefined({
      "compute/machine-type": instance.machineType?.split("/").pop(),
      "compute/type": instance.machineType?.toLowerCase().includes("compute")
        ? "compute"
        : instance.machineType?.toLowerCase().includes("memory") ||
            instance.machineType?.toLowerCase().includes("highmem")
          ? "memory"
          : instance.machineType?.toLowerCase().includes("storage")
            ? "storage"
            : instance.machineType?.toLowerCase().includes("gpu") ||
                instance.machineType?.toLowerCase().includes("tpu")
              ? "accelerated"
              : "standard",

      [ReservedMetadataKey.Links]: JSON.stringify({ "Google Console": appUrl }),

      [ReservedMetadataKey.ExternalId]: instance.id ?? "",
      "google/self-link": instance.selfLink,
      "google/project": projectId,
      "google/zone": instance.zone,
      "compute/can-ip-forward": instance.canIpForward,
      "compute/cpu-platform": instance.cpuPlatform,
      "compute/deletion-protection": instance.deletionProtection,
      "compute/description": instance.description,
      "compute/status": instance.status,
      "compute/disk-count": instance.disks?.length ?? 0,
      "compute/disk-size-gb": _.sumBy(instance.disks, (disk) =>
        disk.diskSizeGb != null ? Number(disk.diskSizeGb) : 0,
      ),
      "compute/disk-type":
        instance.disks?.map((disk) => disk.type).join(", ") ?? "",
      "compute/instance-status": instance.status,
      "compute/fingerprint": instance.fingerprint,
      "compute/hostname": instance.hostname,
      "compute/instance-encryption-key": instance.instanceEncryptionKey,
      "compute/key-revocation-action-type": instance.keyRevocationActionType,
      "compute/kind": instance.kind,
      "compute/last-start-timestamp": instance.lastStartTimestamp,
      "compute/last-stop-timestamp": instance.lastStopTimestamp,
      "compute/last-suspended-timestamp": instance.lastSuspendedTimestamp,
      ...getFlattenedMetadata(instance.metadata ?? undefined),
      "compute/min-cpu-platform": instance.minCpuPlatform,
      "compute/network-performance-config/total-egress-bandwith-tier":
        instance.networkPerformanceConfig?.totalEgressBandwidthTier,
      "compute/private-ipv6-google-access": instance.privateIpv6GoogleAccess,
      "compute/reservation-affinity/consume-reservation-type":
        instance.reservationAffinity?.consumeReservationType,
      "compute/resource-policies":
        instance.resourcePolicies?.join(", ") ?? null,
      "compute/scheduling/automatic-restart":
        instance.scheduling?.automaticRestart,
      "compute/scheduling/availability-domain":
        instance.scheduling?.availabilityDomain,
      "compute/scheduling/instance-termination-action":
        instance.scheduling?.instanceTerminationAction,
      "compute/scheduling/local-ssd-recovery-timeout":
        instance.scheduling?.localSsdRecoveryTimeout,
      "compute/scheduling/location-hint": instance.scheduling?.locationHint,
      "compute/scheduling/max-run-duration":
        instance.scheduling?.maxRunDuration,
      "compute/scheduling/min-node-cpus": instance.scheduling?.minNodeCpus,
      "compute/scheduling/node-affinities":
        instance.scheduling?.nodeAffinities
          ?.map((affinity) => affinity.key)
          .join(", ") ?? null,
      "compute/scheduling/on-host-maintenance":
        instance.scheduling?.onHostMaintenance,
      "compute/scheduling/on-instance-stop-action":
        instance.scheduling?.onInstanceStopAction,
      "compute/scheduling/preemptible": instance.scheduling?.preemptible,
      "compute/scheduling/provisioning-model":
        instance.scheduling?.provisioningModel,
      "compute/scheduling/termination-time":
        instance.scheduling?.terminationTime,
      "compute/service-accounts":
        instance.serviceAccounts?.map((account) => account.email).join(", ") ??
        null,
      ...instance.labels,
      ...getFlattenedTags(instance.tags ?? undefined),
    }),
  };
};

export const getGoogleVMResources = async (
  workspace: SCHEMA.Workspace,
  config: SCHEMA.ResourceProviderGoogle,
): Promise<SCHEMA.InsertResource[]> => {
  if (!config.importVms) return [];
  const { googleServiceAccountEmail } = workspace;
  const [vmClient] = await getVMClient(googleServiceAccountEmail);
  log.info(
    `Scanning VMs for ${config.projectIds.join(", ")} using ${googleServiceAccountEmail}`,
    { workspaceId: workspace.id, config, googleServiceAccountEmail },
  );

  return Promise.all(
    config.projectIds.map(async (projectId) => {
      try {
        const allResources: SCHEMA.InsertResource[] = [];
        for await (const [_, instances] of vmClient.aggregatedListAsync({
          project: projectId,
          returnPartialSuccess: true,
        })) {
          if (instances.instances == null || instances.instances.length === 0)
            continue;
          const resources = instances.instances.map((instance) =>
            instanceToResource(
              instance,
              workspace.id,
              config.resourceProviderId,
              projectId,
            ),
          );
          allResources.push(...resources);
        }

        return allResources;
      } catch (error: any) {
        log.error(
          `Unable to list VMs for provider ${config.id} and project ${projectId}: ${error.message}`,
          { error, projectId, providerId: config.resourceProviderId },
        );
        return [];
      }
    }),
  ).then((results) => results.flat());
};
