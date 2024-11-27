import type { Cluster } from "@aws-sdk/client-eks";
import type { ResourceProviderAws, Workspace } from "@ctrlplane/db/schema";
import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";
import {
  DescribeClusterCommand,
  ListClustersCommand,
} from "@aws-sdk/client-eks";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { AwsClient } from "./aws.js";
import { omitNullUndefined } from "../utils.js";
import { createAwsClient, createEksClient } from "./aws.js";

const log = logger.child({ label: "resource-scan/eks" });

export const clusterToResource = (
  workspaceId: string,
  providerId: string,
  accountId: string,
  cluster: Cluster,
): KubernetesClusterAPIV1 & { workspaceId: string; providerId: string } => {
  const region = cluster.endpoint?.split(".")[2];
  const appUrl = `https://console.aws.amazon.com/eks/home?region=${region}#/clusters/${cluster.name}`;
  const version = cluster.version!;
  const [major, minor] = version.split(".");

  return {
    workspaceId,
    providerId,
    name: cluster.name ?? "",
    identifier: `${accountId}/${cluster.name}`,
    version: "kubernetes/v1" as const,
    kind: "ClusterAPI" as const,
    config: {
      name: cluster.name!,
      auth: {
        method: "aws/eks" as const,
        region: region!,
        clusterName: cluster.name!,
      },
      status: cluster.status ?? "UNKNOWN",
      server: {
        certificateAuthorityData: cluster.certificateAuthority?.data,
        endpoint: cluster.endpoint!,
      },
    },
    metadata: omitNullUndefined({
      [ReservedMetadataKey.Links]: JSON.stringify({ "AWS Console": appUrl }),
      [ReservedMetadataKey.ExternalId]: cluster.arn ?? "",
      [ReservedMetadataKey.KubernetesFlavor]: "eks",
      [ReservedMetadataKey.KubernetesVersion]: cluster.version,

      "aws/arn": cluster.arn,
      "aws/region": region,
      "aws/platform-version": cluster.platformVersion,

      "kubernetes/status": cluster.status,
      "kubernetes/version-major": major,
      "kubernetes/version-minor": minor,

      ...(cluster.tags ?? {}),
    }),
  };
};

const getAwsRegions = async (client: AwsClient) => {
  const ec2Client = new EC2Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: client.credentials.AccessKeyId!,
      secretAccessKey: client.credentials.SecretAccessKey!,
      sessionToken: client.credentials.SessionToken,
    },
  });

  const response = await ec2Client.send(new DescribeRegionsCommand({}));
  return response.Regions?.map((region) => region.RegionName) ?? [];
};

export const getClusters = async (client: AwsClient) => {
  const response = await client.eksClient.send(new ListClustersCommand({}));
  return response.clusters ?? [];
};

const createRegionalClusterScanner = (
  client: AwsClient,
  customerRoleArn: string,
  workspace: Workspace,
  config: ResourceProviderAws,
  accountId: string,
) => {
  return async (region: string) => {
    const regionalClient: AwsClient = {
      credentials: client.credentials,
      eksClient: createEksClient(region, client.credentials),
    };

    const clusters = await getClusters(regionalClient);
    log.info(
      `Found ${clusters.length} clusters for ${customerRoleArn} in region ${region}`,
    );

    const clusterDetails = await Promise.all(
      clusters.map(async (clusterName) => {
        const response = await regionalClient.eksClient.send(
          new DescribeClusterCommand({ name: clusterName }),
        );
        return response.cluster;
      }),
    );

    return clusterDetails
      .filter(isPresent)
      .map((cluster) =>
        clusterToResource(
          workspace.id,
          config.resourceProviderId,
          accountId,
          cluster,
        ),
      );
  };
};

const scanRegionalClusters = async (
  workspaceRoleArn: string,
  customerRoleArn: string,
  workspace: Workspace,
  config: ResourceProviderAws,
) => {
  const client = await createAwsClient(workspaceRoleArn, customerRoleArn);
  const accountId = customerRoleArn.split(":")[4];
  const regions = await getAwsRegions(client);

  log.info(
    `Scanning ${regions.length} AWS regions for EKS clusters in account ${customerRoleArn}`,
  );

  const regionalClusterScanner = createRegionalClusterScanner(
    client,
    customerRoleArn,
    workspace,
    config,
    accountId!,
  );

  return _.chain(regions)
    .map(regionalClusterScanner)
    .thru((promises) => Promise.all(promises))
    .value()
    .then((results) => results.flat());
};

export const getEksResources = async (
  workspace: Workspace,
  config: ResourceProviderAws,
) => {
  const { awsRoleArn: workspaceRoleArn } = workspace;
  log.info(
    `Scanning for EKS cluters with assumed role arns ${config.awsRoleArns.join(", ")} using role ${workspaceRoleArn}`,
    {
      workspaceId: workspace.id,
      config,
      workspaceRoleArn,
    },
  );

  if (workspaceRoleArn == null) return [];

  const resources = await Promise.all(
    config.awsRoleArns.map((customerRoleArn) =>
      scanRegionalClusters(
        workspaceRoleArn,
        customerRoleArn,
        workspace,
        config,
      ),
    ),
  ).then((results) => results.flat());

  const resourceCounts = _.countBy(resources, (resource) =>
    [resource.kind, resource.version].join("/"),
  );

  log.info(`Found ${resources.length} resources`, {
    resourceCounts: Object.entries(resourceCounts)
      .map(([key, count]) => `${key}: ${count}`)
      .join(", "),
  });

  return resources;
};
