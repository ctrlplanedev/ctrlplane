import type {
  InsertResource,
  ResourceProviderGoogle,
  Workspace,
} from "@ctrlplane/db/schema";
import type { CloudVPCV1 } from "@ctrlplane/validators/resources";
import type { google } from "@google-cloud/compute/build/protos/protos.js";
import { NetworksClient } from "@google-cloud/compute";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { omitNullUndefined } from "../../utils.js";
import { getGoogleClient } from "./client.js";

const log = logger.child({ label: "resource-scan/google/vpc" });

const getNetworksClient = async (targetPrincipal?: string | null) =>
  getGoogleClient(NetworksClient, targetPrincipal, "Networks Client");

const getNetworkResources = (
  project: string,
  networks: google.cloud.compute.v1.INetwork[],
): CloudVPCV1[] =>
  networks
    .filter((n) => n.name != null)
    .map((network) => {
      return {
        name: network.name!,
        identifier: `${project}/${network.name}`,
        version: "cloud/v1",
        kind: "VPC",
        config: {
          name: network.name!,
          provider: "google",
          region: "global", // GCP VPC is global; subnets have regional scope
          project,
          cidr: network.IPv4Range ?? undefined,
          mtu: network.mtu ?? undefined,
          subnets: network.subnetworks?.map((subnet) => {
            const parts = subnet.split("/");
            const region = parts.at(-3) ?? "";
            const name = parts.at(-1) ?? "";
            return { name, region };
          }),
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
          ...network.peerings?.reduce(
            (acc, peering) => ({
              ...acc,
              [`google/peering/${peering.name}`]: JSON.stringify({
                network: peering.network,
                state: peering.state,
                autoCreateRoutes: peering.autoCreateRoutes,
              }),
            }),
            {},
          ),
        }),
      };
    });

const fetchProjectNetworks = async (
  networksClient: NetworksClient,
  project: string,
  workspaceId: string,
  providerId: string,
): Promise<InsertResource[]> => {
  try {
    const networks: InsertResource[] = [];
    let pageToken: string | undefined | null;

    do {
      const [networkList, request] = await networksClient.list({
        project,
        maxResults: 500,
        pageToken,
      });

      networks.push(
        ...getNetworkResources(project, networkList).map((resource) => ({
          ...resource,
          workspaceId,
          providerId,
        })),
      );
      pageToken = request?.pageToken;
    } while (pageToken != null);

    return networks;
  } catch (error: any) {
    const isPermissionError =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      error.message?.includes("PERMISSION_DENIED") || error.code === 403;
    log.error(
      `Unable to get VPCs for project: ${project} - ${
        isPermissionError
          ? 'Missing required permissions. Please ensure the service account has the "Compute Network Viewer" role.'
          : error.message
      }`,
      { error, project },
    );
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

  const [networksClient] = await getNetworksClient(googleServiceAccountEmail);
  const resources: InsertResource[] = await _.chain(config.projectIds)
    .map((id) =>
      fetchProjectNetworks(networksClient, id, workspaceId, resourceProviderId),
    )
    .thru((promises) => Promise.all(promises))
    .value()
    .then((results) => results.flat());

  log.info(`Found ${resources.length} VPC resources`);

  return resources;
};
