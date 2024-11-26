import type { Cluster } from "@aws-sdk/client-eks";
import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";
import {
  DescribeClusterCommand,
  ListClustersCommand,
} from "@aws-sdk/client-eks";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { CoreV1Api } from "@kubernetes/client-node";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { kubernetesNamespaceV1 } from "@ctrlplane/validators/resources";

import { connectToCluster, createEksClient } from "./aws-connect.js";
import { env } from "./config.js";
import { omitNullUndefined } from "./utils.js";

export const eksLogger = logger.child({ label: "eks" });

const getAwsRegions = async (credentials: any) => {
  const ec2Client = new EC2Client({
    region: "us-east-1",
    credentials,
  });

  const response = await ec2Client.send(new DescribeRegionsCommand({}));
  return response.Regions?.map((region) => region.RegionName) ?? [];
};

async function getRegionalEksClusters(region: string) {
  const regionalEksClient = createEksClient(region);
  try {
    const response = await regionalEksClient.send(new ListClustersCommand({}));
    return (
      response.clusters?.map((cluster) => ({ region, name: cluster })) ?? []
    );
  } catch (error) {
    eksLogger.warn(`Error fetching clusters in region ${region}:`, error);
    return [];
  }
}

const getClusters = async () => {
  const eksClient = createEksClient("us-east-1");
  const credentials = eksClient.config.credentials;
  const stsClient = new STSClient({ region: "us-east-1", credentials });

  try {
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    eksLogger.info("Authenticated AWS Identity:", identity);

    const regions = await getAwsRegions(credentials);
    eksLogger.info(`Scanning ${regions.length} AWS regions for EKS clusters`);

    const allClusters = await Promise.all(
      regions.map((region) => getRegionalEksClusters(region!)),
    );
    return allClusters.flat();
  } catch (error) {
    eksLogger.error("Error fetching clusters or AWS identity:", error);
    throw error;
  }
};

export const getKubernetesClusters = async (): Promise<
  Array<{
    cluster: Cluster;
    region: string;
    resource: KubernetesClusterAPIV1;
  }>
> => {
  eksLogger.info("Scanning AWS EKS clusters");
  const clusters = await getClusters();

  const clusterDetails = [];
  for (const { name, region } of clusters) {
    const eksClient = createEksClient(region);
    const cluster = await eksClient.send(new DescribeClusterCommand({ name }));
    if (cluster.cluster) {
      clusterDetails.push({ cluster: cluster.cluster, name, region });
    }
  }

  return clusterDetails.map(({ cluster: clusterInfo, name, region }) => {
    const appUrl = `https://console.aws.amazon.com/eks/home?region=${env.AWS_REGION}#/clusters/${name}`;
    const version = clusterInfo.version ?? "0";
    const [major, minor] = version.split(".");

    return {
      cluster: clusterInfo,
      region: region,
      resource: {
        version: "kubernetes/v1",
        kind: "ClusterAPI",
        name: name,
        identifier: `${env.AWS_ACCOUNT_ID}/${name}`,
        config: {
          name: name,
          auth: {
            method: "aws/eks",
            region: region,
            project: env.AWS_ACCOUNT_ID,
            location: clusterInfo.endpoint,
            clusterName: name,
          },
          status: clusterInfo.status ?? "UNKNOWN",
          server: {
            certificateAuthorityData: clusterInfo.certificateAuthority?.data,
            endpoint: clusterInfo.endpoint ?? "",
          },
        },
        metadata: omitNullUndefined({
          [ReservedMetadataKey.Links]: JSON.stringify({
            "AWS Console": appUrl,
          }),
          [ReservedMetadataKey.ExternalId]: clusterInfo.arn ?? "",
          [ReservedMetadataKey.KubernetesFlavor]: "eks",
          [ReservedMetadataKey.KubernetesVersion]: clusterInfo.version,

          "aws/arn": clusterInfo.arn,
          "aws/region": region,
          "aws/platform-version": clusterInfo.platformVersion,

          "kubernetes/status": clusterInfo.status,
          "kubernetes/version-major": major ?? "",
          "kubernetes/version-minor": minor ?? "",

          ...(clusterInfo.tags ?? {}),
        }),
      },
    };
  });
};

export const getKubernetesNamespace = async (
  clusters: Array<{
    cluster: Cluster;
    region: string;
    resource: KubernetesClusterAPIV1;
  }>,
) => {
  const namespaceResources = clusters.map(
    async ({ cluster, resource, region }) => {
      try {
        if (cluster.name == null) throw new Error("Cluster name is required");

        const kubeConfig = await connectToCluster(cluster.name, region);
        const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
        const namespaceList = await k8sApi.listNamespace();
        const namespaces = namespaceList.body.items.filter((n) => n.metadata);
        const ignoreList = env.CTRLPLANE_EKS_NAMESPACE_IGNORE.split(",");

        return namespaces
          .filter((n) => {
            const namespaceName = n.metadata?.name;
            return namespaceName && !ignoreList.includes(namespaceName);
          })
          .map((n) => {
            const namespaceName = n.metadata?.name;
            if (namespaceName == null)
              throw new Error("Namespace name is required");

            return kubernetesNamespaceV1.parse(
              _.merge(_.cloneDeep(resource), {
                kind: "Namespace",
                name: namespaceName,
                identifier: `${env.AWS_ACCOUNT_ID}/${cluster.name}/${namespaceName}`,
                config: { namespace: namespaceName },
                metadata: {
                  "ctrlplane/parent-target-identifier": resource.identifier,
                  "kubernetes/namespace": namespaceName,
                  ...n.metadata?.labels,
                },
              }),
            );
          });
      } catch (error) {
        eksLogger.error(
          `Error processing namespace for cluster ${cluster.name}:`,
          error,
        );
        return [];
      }
    },
  );

  return Promise.all(namespaceResources).then((v) => v.flat());
};
