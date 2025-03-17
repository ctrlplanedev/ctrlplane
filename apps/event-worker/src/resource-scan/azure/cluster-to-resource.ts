import type {
  ContainerServiceClient,
  ManagedCluster,
} from "@azure/arm-containerservice";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import * as yaml from "js-yaml";
import { z } from "zod";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { omitNullUndefined } from "../../utils.js";

const log = logger.child({ module: "resource-scan/azure" });

type ClusterResource = KubernetesClusterAPIV1 & {
  workspaceId: string;
  providerId: string;
};

const cluster = z.object({
  "certificate-authority-data": z.string(),
  server: z.string(),
});
const kubeConfigSchema = z.object({ clusters: z.array(z.object({ cluster })) });

const getCertificateAuthorityData = async (
  cluster: ManagedCluster,
  resourceGroup: string,
  client: ContainerServiceClient,
) => {
  try {
    const { kubernetesVersion, name } = cluster;
    if (!kubernetesVersion || !name) return null;

    const kubeConfigRaw = await client.managedClusters
      .getAccessProfile(resourceGroup, name, "clusterAdmin")
      .then((profile) => profile.kubeConfig);
    if (!kubeConfigRaw) return null;

    const kubeConfigYaml = Buffer.from(kubeConfigRaw).toString("utf-8");
    const kubeConfig = yaml.load(kubeConfigYaml);

    const parsedKubeConfig = kubeConfigSchema.parse(kubeConfig);
    const { cluster: parsedCluster } = parsedKubeConfig.clusters[0] ?? {};
    if (!parsedCluster) return null;
    return {
      endpoint: parsedCluster.server,
      certificateAuthorityData: parsedCluster["certificate-authority-data"],
    };
  } catch (error) {
    log.error("Error getting certificate authority data for cluster", {
      cluster: { name: cluster.name, id: cluster.id },
      error,
    });
    return null;
  }
};

export const convertManagedClusterToResource = async (
  workspaceId: string,
  provider: SCHEMA.ResourceProviderAzure,
  tenantId: string,
  cluster: ManagedCluster,
  client: ContainerServiceClient,
): Promise<ClusterResource | null> => {
  if (!cluster.name || !cluster.id) {
    log.error("Invalid cluster", { cluster });
    return null;
  }

  const resourceGroup = cluster.id.split("/resourcegroups/")[1]?.split("/")[0];
  if (!resourceGroup) {
    log.error("Invalid cluster", { cluster });
    return null;
  }

  const ca = await getCertificateAuthorityData(cluster, resourceGroup, client);
  return {
    workspaceId,
    providerId: provider.resourceProviderId,
    name: cluster.name,
    identifier: cluster.id,
    version: "kubernetes/v1",
    kind: "ClusterAPI",
    config: {
      name: cluster.name,
      auth: {
        method: "azure/aks",
        clusterName: cluster.name,
        resourceGroup,
        tenantId,
        subscriptionId: provider.subscriptionId,
      },
      server: { ...ca, endpoint: ca?.endpoint ?? cluster.fqdn ?? "" },
    },
    metadata: omitNullUndefined({
      [ReservedMetadataKey.Links]: cluster.azurePortalFqdn
        ? JSON.stringify({ "Azure Portal": cluster.azurePortalFqdn })
        : undefined,
      [ReservedMetadataKey.ExternalId]: cluster.id ?? "",
      [ReservedMetadataKey.KubernetesFlavor]: "aks",
      [ReservedMetadataKey.KubernetesVersion]: cluster.currentKubernetesVersion,
      [ReservedMetadataKey.KubernetesStatus]:
        cluster.provisioningState === "InProgress"
          ? "creating"
          : cluster.powerState?.code === "Running"
            ? "running"
            : "unknown",

      "azure/tenant-id": tenantId,
      "azure/subscription-id": provider.subscriptionId,
      "azure/self-link": cluster.id,
      "azure/resource-group": cluster.nodeResourceGroup,
      "azure/location": cluster.location,
      "azure/platform-version": cluster.kubernetesVersion,
      "azure/enable-rbac": cluster.enableRbac,
      "azure/enable-oidc": cluster.oidcIssuerProfile?.enabled,
      "azure/enable-disk-csi-driver":
        cluster.storageProfile?.diskCSIDriver?.enabled,
      "azure/enable-file-csi-driver":
        cluster.storageProfile?.fileCSIDriver?.enabled,
      "azure/enable-snapshot-controller":
        cluster.storageProfile?.snapshotController?.enabled,
      "azure/service-principal-profile/client-id":
        cluster.servicePrincipalProfile?.clientId,
      "azure/oidc-issuer-profile/enabled": cluster.oidcIssuerProfile?.enabled,
      "azure/oidc-issuer-profile/issuer-url":
        cluster.oidcIssuerProfile?.issuerURL,
      "azure/storage-profile/disk-csi-driver/enabled":
        cluster.storageProfile?.diskCSIDriver?.enabled,
      "azure/storage-profile/file-csi-driver/enabled":
        cluster.storageProfile?.fileCSIDriver?.enabled,
      "azure/storage-profile/snapshot-controller/enabled":
        cluster.storageProfile?.snapshotController?.enabled,
      "azure/network-profile/network-plugin":
        cluster.networkProfile?.networkPlugin,
      "azure/network-profile/network-policy":
        cluster.networkProfile?.networkPolicy,
      "azure/network-profile/pod-cidr": cluster.networkProfile?.podCidr,
      "azure/network-profile/service-cidr": cluster.networkProfile?.serviceCidr,
      "azure/network-profile/dns-service-ip":
        cluster.networkProfile?.dnsServiceIP,
      "azure/network-profile/load-balancer-sku":
        cluster.networkProfile?.loadBalancerSku,
      "azure/network-profile/outbound-type":
        cluster.networkProfile?.outboundType,
      "azure/addon-profiles/http-application-routing/enabled":
        cluster.addonProfiles?.httpApplicationRouting?.enabled,
      "azure/addon-profiles/monitoring/enabled":
        cluster.addonProfiles?.omsagent?.enabled,
      "azure/addon-profiles/azure-policy/enabled":
        cluster.addonProfiles?.azurepolicy?.enabled,
      "azure/addon-profiles/ingress-application-gateway/enabled":
        cluster.addonProfiles?.ingressApplicationGateway?.enabled,
      "azure/addon-profiles/open-service-mesh/enabled":
        cluster.addonProfiles?.openServiceMesh?.enabled,
      "azure/identity/type": cluster.identity?.type,
      "azure/provisioning-state": cluster.provisioningState,
      "azure/power-state": cluster.powerState?.code,
      "azure/max-agent-pools": String(cluster.maxAgentPools),
      "azure/dns-prefix": cluster.dnsPrefix,
      "azure/fqdn": cluster.fqdn,
      "azure/portal-fqdn": cluster.azurePortalFqdn,
      "azure/support-plan": cluster.supportPlan,
      "azure/disable-local-accounts": cluster.disableLocalAccounts,
      "azure/auto-upgrade-profile/channel":
        cluster.autoUpgradeProfile?.upgradeChannel,
      "azure/sku/name": cluster.sku?.name,
      "azure/sku/tier": cluster.sku?.tier,
      "azure/agent-pool-profiles": JSON.stringify(cluster.agentPoolProfiles),
      "azure/windows-profile/admin-username":
        cluster.windowsProfile?.adminUsername,
      "azure/windows-profile/enable-csi-proxy":
        cluster.windowsProfile?.enableCSIProxy,
      "azure/addon-profiles/azure-policy/identity/resource-id":
        cluster.addonProfiles?.azurepolicy?.identity?.resourceId,
      "azure/addon-profiles/azure-policy/identity/client-id":
        cluster.addonProfiles?.azurepolicy?.identity?.clientId,
      "azure/addon-profiles/azure-policy/identity/object-id":
        cluster.addonProfiles?.azurepolicy?.identity?.objectId,
      "azure/addon-profiles/ingress-application-gateway/config/application-gateway-id":
        cluster.addonProfiles?.ingressApplicationGateway?.config
          ?.applicationGatewayId,
      "azure/addon-profiles/ingress-application-gateway/config/effective-application-gateway-id":
        cluster.addonProfiles?.ingressApplicationGateway?.config
          ?.effectiveApplicationGatewayId,
      "azure/addon-profiles/ingress-application-gateway/identity/resource-id":
        cluster.addonProfiles?.ingressApplicationGateway?.identity?.resourceId,
      "azure/addon-profiles/ingress-application-gateway/identity/client-id":
        cluster.addonProfiles?.ingressApplicationGateway?.identity?.clientId,
      "azure/addon-profiles/ingress-application-gateway/identity/object-id":
        cluster.addonProfiles?.ingressApplicationGateway?.identity?.objectId,
      "azure/network-profile/network-dataplane":
        cluster.networkProfile?.networkDataplane,
      "azure/network-profile/load-balancer-profile/managed-outbound-ips/count":
        cluster.networkProfile?.loadBalancerProfile?.managedOutboundIPs?.count,
      "azure/network-profile/load-balancer-profile/managed-outbound-ips/count-ipv6":
        cluster.networkProfile?.loadBalancerProfile?.managedOutboundIPs
          ?.countIPv6,
      "azure/network-profile/load-balancer-profile/effective-outbound-ips":
        JSON.stringify(
          cluster.networkProfile?.loadBalancerProfile?.effectiveOutboundIPs,
        ),
      "azure/network-profile/load-balancer-profile/allocated-outbound-ports":
        cluster.networkProfile?.loadBalancerProfile?.allocatedOutboundPorts,
      "azure/network-profile/load-balancer-profile/idle-timeout-in-minutes":
        cluster.networkProfile?.loadBalancerProfile?.idleTimeoutInMinutes,
      "azure/network-profile/load-balancer-profile/backend-pool-type":
        cluster.networkProfile?.loadBalancerProfile?.backendPoolType,
      "azure/network-profile/service-cidrs": JSON.stringify(
        cluster.networkProfile?.serviceCidrs,
      ),
      "azure/network-profile/ip-families": JSON.stringify(
        cluster.networkProfile?.ipFamilies,
      ),
      "azure/identity-profile/kubeletidentity/resource-id":
        cluster.identityProfile?.kubeletidentity?.resourceId,
      "azure/identity-profile/kubeletidentity/client-id":
        cluster.identityProfile?.kubeletidentity?.clientId,
      "azure/identity-profile/kubeletidentity/object-id":
        cluster.identityProfile?.kubeletidentity?.objectId,
      "azure/security-profile/defender/enable-defender":
        cluster.securityProfile?.defender?.securityMonitoring?.enabled,
      "azure/security-profile/defender/log-analytics-workspace-id":
        cluster.securityProfile?.defender?.logAnalyticsWorkspaceResourceId,
      "azure/security-profile/defender/security-monitoring/enabled":
        cluster.securityProfile?.defender?.securityMonitoring?.enabled,
    }),
  };
};
