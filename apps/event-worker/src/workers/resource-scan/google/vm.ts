import type * as SCHEMA from "@ctrlplane/db/schema";
import type { VmV1 } from "@ctrlplane/validators/resources";
import type { google } from "@google-cloud/compute/build/protos/protos.js";
import { InstancesClient } from "@google-cloud/compute";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { omitNullUndefined } from "../../../utils.js";
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
): VmV1 => {
  const instanceZone =
    instance.zone != null ? instance.zone.split("/").pop() : null;
  const appUrl = `https://console.cloud.google.com/compute/instancesDetail/zones/${instanceZone}/instances/${instance.name}?project=${projectId}`;
  return {
    workspaceId,
    name: String(instance.name ?? instance.id ?? ""),
    providerId,
    identifier: `${projectId}/${instance.name}`,
    version: "vm/v1",
    kind: "VM",
    config: {
      name: String(instance.name ?? instance.id ?? ""),
      status: instance.status ?? "STATUS_UNSPECIFIED",
      id: String(instance.id ?? ""),
      machineType: instance.machineType?.split("/").pop() ?? "",
      type: { type: "google", project: projectId, zone: instanceZone ?? "" },
      disks:
        instance.disks?.map((disk) => ({
          name: disk.deviceName ?? "",
          size: Number(disk.diskSizeGb),
          type: disk.type ?? "",
          encrypted: disk.diskEncryptionKey?.rawKey != null,
        })) ?? [],
    },
    metadata: omitNullUndefined({
      [ReservedMetadataKey.Links]: JSON.stringify({
        "Google Console": appUrl,
      }),
      [ReservedMetadataKey.ExternalId]: instance.id ?? "",
      "google/self-link": instance.selfLink,
      "google/project": projectId,
      "google/zone": instance.zone,
      "vm/machine-type": instance.machineType?.split("/").pop() ?? null,
      "vm/can-ip-forward": instance.canIpForward,
      "vm/cpu-platform": instance.cpuPlatform,
      "vm/deletion-protection": instance.deletionProtection,
      "vm/description": instance.description,
      "vm/status": instance.status,
      "vm/disk-count": instance.disks?.length ?? 0,
      "vm/disk-size-gb": _.sumBy(instance.disks, (disk) =>
        disk.diskSizeGb != null ? Number(disk.diskSizeGb) : 0,
      ),
      "vm/disk-type": instance.disks?.map((disk) => disk.type).join(", ") ?? "",
      "vm/instance-status": instance.status,
      "vm/fingerprint": instance.fingerprint,
      "vm/hostname": instance.hostname,
      "vm/instance-encryption-key": instance.instanceEncryptionKey,
      "vm/key-revocation-action-type": instance.keyRevocationActionType,
      "vm/kind": instance.kind,
      ..._.mapKeys(instance.labels ?? {}, (_value, key) => `vm/label/${key}`),
      "vm/last-start-timestamp": instance.lastStartTimestamp,
      "vm/last-stop-timestamp": instance.lastStopTimestamp,
      "vm/last-suspended-timestamp": instance.lastSuspendedTimestamp,
      ...getFlattenedMetadata(instance.metadata ?? undefined),
      "vm/min-cpu-platform": instance.minCpuPlatform,
      "vm/network-performance-config/total-egress-bandwith-tier":
        instance.networkPerformanceConfig?.totalEgressBandwidthTier,
      "vm/private-ipv6-google-access": instance.privateIpv6GoogleAccess,
      "vm/reservation-affinity/consume-reservation-type":
        instance.reservationAffinity?.consumeReservationType,
      "vm/resource-policies": instance.resourcePolicies?.join(", ") ?? null,
      "vm/scheduling/automatic-restart": instance.scheduling?.automaticRestart,
      "vm/scheduling/availability-domain":
        instance.scheduling?.availabilityDomain,
      "vm/scheduling/instance-termination-action":
        instance.scheduling?.instanceTerminationAction,
      "vm/scheduling/local-ssd-recovery-timeout":
        instance.scheduling?.localSsdRecoveryTimeout,
      "vm/scheduling/location-hint": instance.scheduling?.locationHint,
      "vm/scheduling/max-run-duration": instance.scheduling?.maxRunDuration,
      "vm/scheduling/min-node-cpus": instance.scheduling?.minNodeCpus,
      "vm/scheduling/node-affinities":
        instance.scheduling?.nodeAffinities
          ?.map((affinity) => affinity.key)
          .join(", ") ?? null,
      "vm/scheduling/on-host-maintenance":
        instance.scheduling?.onHostMaintenance,
      "vm/scheduling/on-instance-stop-action":
        instance.scheduling?.onInstanceStopAction,
      "vm/scheduling/preemptible": instance.scheduling?.preemptible,
      "vm/scheduling/provisioning-model":
        instance.scheduling?.provisioningModel,
      "vm/scheduling/termination-time": instance.scheduling?.terminationTime,
      "vm/service-accounts":
        instance.serviceAccounts?.map((account) => account.email).join(", ") ??
        null,
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
