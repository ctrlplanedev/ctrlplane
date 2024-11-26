import type { Cluster } from "@aws-sdk/client-eks";
import type { ResourceProviderAws, Workspace } from "@ctrlplane/db/schema";
import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";
import {
  DescribeClusterCommand,
  ListClustersCommand,
} from "@aws-sdk/client-eks";
import { CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { AwsClient } from "./aws.js";
import { omitNullUndefined } from "../utils.js";
import { createEksClient, getClient } from "./aws.js";
import { createNamespaceResource } from "./kube.js";

const log = logger.child({ label: "resource-scan/eks" });

export const getClusters = async (client: AwsClient) => {
  const request = {};
  const response = await client.eksClient.send(
    new ListClustersCommand(request),
  );
  return response.clusters ?? [];
};

export const connectToCluster = async (
  client: AwsClient,
  clusterName: string,
  role: string,
) => {
  const response = await client.eksClient.send(
    new DescribeClusterCommand({ name: clusterName }),
  );

  if (!response.cluster) {
    throw new Error(`Cluster ${clusterName} not found`);
  }

  const region = response.cluster.endpoint?.split(".")[2] ?? "";
  const clusterArn = response.cluster.arn ?? clusterName;

  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromOptions({
    clusters: [
      {
        name: clusterArn,
        server: response.cluster.endpoint ?? "",
        caData: response.cluster.certificateAuthority?.data,
      },
    ],
    users: [
      {
        name: clusterArn,
        exec: {
          apiVersion: "client.authentication.k8s.io/v1",
          command: "aws",
          args: [
            "--region",
            region,
            "eks",
            "get-token",
            "--cluster-name",
            clusterName,
            "--output",
            "json",
            "--role",
            role,
          ],
        },
      },
    ],
    contexts: [
      {
        name: clusterArn,
        cluster: clusterArn,
        user: clusterArn,
      },
    ],
    currentContext: clusterArn,
  });

  return kubeConfig;
};

export const clusterToResource = (
  workspaceId: string,
  providerId: string,
  accountId: string,
  cluster: Cluster,
): KubernetesClusterAPIV1 & { workspaceId: string; providerId: string } => {
  const region = cluster.endpoint?.split(".")[2];
  const appUrl = `https://console.aws.amazon.com/eks/home?region=${region}#/clusters/${cluster.name}`;
  const version = cluster.version ?? "0";
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
      "kubernetes/version-major": major ?? "",
      "kubernetes/version-minor": minor ?? "",

      ...(cluster.tags ?? {}),
    }),
  };
};

const getNamespacesForCluster = async (
  kubeConfig: KubeConfig,
  accountId: string,
  cluster: Cluster,
  workspaceId: string,
  resourceProviderId: string,
) => {
  if (cluster.name == null) {
    log.warn(`Skipping cluster with missing name`, {
      accountId,
      cluster,
      workspaceId,
    });
    return [];
  }

  const context = kubeConfig.getCurrentContext();
  if (!context) {
    throw new Error("No current context found in kubeConfig");
  }

  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

  try {
    const response = await k8sApi.listNamespace();
    const namespaces = response.body.items;
    const clusterResource = clusterToResource(
      workspaceId,
      resourceProviderId,
      accountId,
      cluster,
    );

    return namespaces
      .filter((n) => n.metadata?.name != null)
      .map((n) =>
        createNamespaceResource(clusterResource, n, accountId, cluster),
      );
  } catch (error: any) {
    log.error(
      `Unable to list namespaces for cluster: ${cluster.name} - ${error.message}`,
      { error, accountId, cluster, workspaceId },
    );
    return [];
  }
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

export const getEksResources = async (
  workspace: Workspace,
  config: ResourceProviderAws,
): Promise<
  Array<KubernetesClusterAPIV1 & { workspaceId: string; providerId: string }>
> => {
  const { awsRole } = workspace;
  log.info(`Scanning ${config.accountIds.join(", ")} using role ${awsRole}`, {
    workspaceId: workspace.id,
    config,
    awsRole,
  });

  const client = await getClient(awsRole);
  const resources: Array<
    KubernetesClusterAPIV1 & { workspaceId: string; providerId: string }
  > = [];

  const regions = await getAwsRegions(client);
  log.info(`Scanning ${regions.length} AWS regions for EKS clusters`);

  for (const accountId of config.accountIds) {
    for (const region of regions) {
      try {
        const regionalClient: AwsClient = {
          credentials: client.credentials,
          eksClient: createEksClient(region!, client.credentials),
        };

        const clusters = await getClusters(regionalClient);
        log.info(
          `Found ${clusters.length} clusters in account ${accountId} region ${region}`,
        );

        for (const clusterName of clusters) {
          try {
            const response = await regionalClient.eksClient.send(
              new DescribeClusterCommand({ name: clusterName }),
            );

            if (response.cluster) {
              if (config.importEks) {
                resources.push(
                  clusterToResource(
                    workspace.id,
                    config.resourceProviderId,
                    accountId,
                    response.cluster,
                  ),
                );
              }

              if (config.importNamespaces) {
                const kubeConfig = await connectToCluster(
                  regionalClient,
                  clusterName,
                  workspace.awsRole!,
                );
                resources.push(
                  ...(await getNamespacesForCluster(
                    kubeConfig,
                    accountId,
                    response.cluster,
                    workspace.id,
                    config.resourceProviderId,
                  )),
                );
              }
            }
          } catch (error: any) {
            log.error(
              `Failed to process cluster ${clusterName} in region ${region}: ${error.message}`,
              {
                error,
                clusterName,
                accountId,
                region,
                workspaceId: workspace.id,
              },
            );
          }
        }
      } catch (error: any) {
        log.error(
          `Failed to get clusters for account ${accountId} in region ${region}: ${error.message}`,
          {
            error,
            accountId,
            region,
            workspaceId: workspace.id,
          },
        );
      }
    }
  }

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
