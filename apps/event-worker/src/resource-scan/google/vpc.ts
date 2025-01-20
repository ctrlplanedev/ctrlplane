import type {
  InsertResource,
  ResourceProviderGoogle,
  Workspace,
} from "@ctrlplane/db/schema";
import type {
  CloudSubnetV1,
  CloudVPCV1,
} from "@ctrlplane/validators/resources";
import type { google } from "@google-cloud/compute/build/protos/protos.js";
import { NetworksClient, SubnetworksClient } from "@google-cloud/compute";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { omitNullUndefined } from "../../utils.js";
import { getGoogleClient } from "./client.js";

const log = logger.child({ label: "resource-scan/google/vpc" });

const getNetworksClient = async (targetPrincipal?: string | null) => {
  const [networksClient] = await getGoogleClient(
    NetworksClient,
    targetPrincipal,
    "Networks Client",
  );
  const [subnetsClient] = await getGoogleClient(
    SubnetworksClient,
    targetPrincipal,
    "Subnets Client",
  );
  return { networksClient, subnetsClient };
};

const getSubnetDetails = (
  subnetsClient: SubnetworksClient,
  project: string,
  subnetSelfLink: string,
): Promise<CloudSubnetV1 | null> => {
  const parts = subnetSelfLink.split("/");
  const region = parts.at(-3) ?? "";
  const name = parts.at(-1) ?? "";

  return subnetsClient
    .list({
      project,
      region,
      filter: `name eq ${name}`,
    })
    .then(([subnets]) => {
      const subnet = subnets.find((subnet) => subnet.name === name);
      if (subnet === undefined) return null;

      return {
        name,
        region,
        gatewayAddress: subnet.gatewayAddress ?? "",
        cidr: subnet.ipCidrRange ?? "",
        type: subnet.purpose === "INTERNAL" ? "internal" : "external",
        secondaryCidrs: subnet.secondaryIpRanges?.map((r) => ({
          name: r.rangeName ?? "",
          cidr: r.ipCidrRange ?? "",
        })),
      };
    });
};

const getNetworkResources = async (
  clients: { networksClient: NetworksClient; subnetsClient: SubnetworksClient },
  project: string,
  networks: google.cloud.compute.v1.INetwork[],
): Promise<CloudVPCV1[]> =>
  await Promise.all(
    networks
      .filter((n) => n.name != null)
      .map(async (network) => {
        const subnets = await Promise.all(
          (network.subnetworks ?? []).map((subnet) =>
            getSubnetDetails(clients.subnetsClient, project, subnet),
          ),
        );
        return {
          name: network.name!,
          identifier: `${project}/${network.name}`,
          version: "cloud/v1",
          kind: "VPC",
          config: {
            name: network.name!,
            provider: "google",
            region: "global",
            project,
            cidr: network.IPv4Range ?? undefined,
            mtu: network.mtu ?? undefined,
            subnets: subnets.filter(isPresent),
          },
          metadata: omitNullUndefined({
            [ReservedMetadataKey.ExternalId]: network.id?.toString(),
            [ReservedMetadataKey.Links]: JSON.stringify({
              "Google Console": `https://console.cloud.google.com/networking/networks/details/${network.name}?project=${project}`,
            }),
            "google/project": project,
            "google/self-link": network.selfLink,
            "google/creation-timestamp": network.creationTimestamp,
            "google/description": network.description,
            ...(network.peerings
              ? Object.fromEntries(
                  network.peerings.flatMap((peering) => [
                    [`google/peering/${peering.name}/network`, peering.network],
                    [`google/peering/${peering.name}/state`, peering.state],
                    [
                      `google/peering/${peering.name}/auto-create-routes`,
                      peering.autoCreateRoutes?.toString() ?? "false",
                    ],
                  ]),
                )
              : {}),
          }),
        };
      }),
  );

const fetchProjectNetworks = async (
  clients: { networksClient: NetworksClient; subnetsClient: SubnetworksClient },
  project: string,
  workspaceId: string,
  providerId: string,
): Promise<InsertResource[]> => {
  try {
    const networks: InsertResource[] = [];
    let pageToken: string | undefined | null;

    do {
      const [networkList, request] = await clients.networksClient.list({
        project,
        maxResults: 500,
        pageToken,
      });

      networks.push(
        ...(await getNetworkResources(clients, project, networkList)).map(
          (resource) => ({
            ...resource,
            workspaceId,
            providerId,
          }),
        ),
      );
      pageToken = request?.pageToken;
    } while (pageToken != null);

    return networks;
  } catch (err) {
    const { message, code } = err as { message?: string; code?: number };
    const errorMessage =
      message?.includes("PERMISSION_DENIED") || code === 403
        ? 'Missing required permissions. Please ensure the service account has the "Compute Network Viewer" role.'
        : (message ?? "Unknown error");

    log.error(`Unable to get VPCs for project: ${project} - ${errorMessage}`, {
      error: err,
      project,
    });
    return [];
  }
};

export const getVpcResources = async (
  workspace: Workspace,
  config: ResourceProviderGoogle,
) => {
  const { googleServiceAccountEmail, id: workspaceId } = workspace;
  const { resourceProviderId } = config;
  log.info(
    `Scanning VPCs in ${config.projectIds.join(", ")} using ${googleServiceAccountEmail}`,
    { workspaceId, config, googleServiceAccountEmail, resourceProviderId },
  );

  const clients = await getNetworksClient(googleServiceAccountEmail);
  const resources: InsertResource[] = config.importVpc
    ? await _.chain(config.projectIds)
        .map((id) =>
          fetchProjectNetworks(clients, id, workspaceId, resourceProviderId),
        )
        .thru((promises) => Promise.all(promises))
        .value()
        .then((results) => results.flat())
    : [];

  log.info(`Found ${resources.length} VPC resources`);

  return resources;
};
