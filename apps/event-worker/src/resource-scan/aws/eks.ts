import type { Cluster, EKSClient } from "@aws-sdk/client-eks";
import type { STSClient } from "@aws-sdk/client-sts";
import type { ResourceProviderAws, Workspace } from "@ctrlplane/db/schema";
import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/resources";
import { DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import {
  DescribeClusterCommand,
  ListClustersCommand,
} from "@aws-sdk/client-eks";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { AwsCredentials } from "./aws.js";
import { omitNullUndefined } from "../../utils.js";
import { assumeRole, assumeWorkspaceRole } from "./aws.js";

const log = logger.child({ label: "resource-scan/eks" });

const convertEksClusterToKubernetesResource = (
  accountId: string,
  cluster: Cluster,
): KubernetesClusterAPIV1 => {
  const region = cluster.endpoint?.split(".")[2];

  const partition =
    cluster.arn?.split(":")[1] ??
    (region?.startsWith("us-gov-") ? "aws-us-gov" : "aws");

  const appUrl = `https://${
    partition === "aws-us-gov"
      ? `console.${region}.${partition}`
      : "console.aws.amazon"
  }.com/eks/home?region=${region}#/clusters/${cluster.name}`;

  const version = cluster.version!;
  const [major, minor] = version.split(".");

  return {
    name: cluster.name ?? "",
    identifier: `aws/${accountId}/eks/${cluster.name}`,
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

const getAwsRegions = async (credentials: AwsCredentials) =>
  credentials
    .ec2()
    .send(new DescribeRegionsCommand({}))
    .then(({ Regions = [] }) => Regions.map((region) => region.RegionName));

const getClusters = async (client: EKSClient) =>
  client
    .send(new ListClustersCommand({}))
    .then((response) => response.clusters ?? []);

const createEksClusterScannerForRegion = (
  client: AwsCredentials,
  customerRoleArn: string,
) => {
  const accountId = /arn:aws:iam::(\d+):/.exec(customerRoleArn)?.[1];
  if (accountId == null) throw new Error("Missing account ID");

  return async (region: string) => {
    const eksClient = client.eks(region);
    const clusters = await getClusters(eksClient);
    log.info(
      `Found ${clusters.length} clusters for ${customerRoleArn} in region ${region}`,
    );

    return _.chain(clusters)
      .map((name) =>
        eksClient
          .send(new DescribeClusterCommand({ name }))
          .then(({ cluster }) => cluster),
      )
      .thru((promises) => Promise.all(promises))
      .value()
      .then((clusterDetails) =>
        clusterDetails
          .filter(isPresent)
          .map((cluster) =>
            convertEksClusterToKubernetesResource(accountId, cluster),
          ),
      );
  };
};

const scanEksClustersByAssumedRole = async (
  workspaceClient: STSClient,
  customerRoleArn: string,
) => {
  const client = await assumeRole(workspaceClient, customerRoleArn);
  const regions = await getAwsRegions(client);

  log.info(
    `Scanning ${regions.length} AWS regions for EKS clusters in account ${customerRoleArn}`,
  );

  const regionalClusterScanner = createEksClusterScannerForRegion(
    client,
    customerRoleArn,
  );

  return _.chain(regions)
    .filter(isPresent)
    .map(regionalClusterScanner)
    .thru((promises) => Promise.all(promises))
    .value()
    .then((results) => results.flat());
};

export const getEksResources = async (
  workspace: Workspace,
  config: ResourceProviderAws,
) => {
  if (!config.importEks) return [];
  const { awsRoleArn: workspaceRoleArn } = workspace;
  if (workspaceRoleArn == null) return [];

  log.info(
    `Scanning for EKS cluters with assumed role arns ${config.awsRoleArns.join(", ")} using role ${workspaceRoleArn}`,
    {
      workspaceId: workspace.id,
      config,
      workspaceRoleArn,
    },
  );

  const credentials = await assumeWorkspaceRole(workspaceRoleArn);
  const workspaceStsClient = credentials.sts();

  const resources = await _.chain(config.awsRoleArns)
    .map((customerRoleArn) =>
      scanEksClustersByAssumedRole(workspaceStsClient, customerRoleArn),
    )
    .thru((promises) => Promise.all(promises))
    .value()
    .then((results) => results.flat())
    .then((resources) =>
      resources.map((resource) => ({
        ...resource,
        workspaceId: workspace.id,
        providerId: config.resourceProviderId,
      })),
    );

  const resourceTypes = _.countBy(resources, (resource) =>
    [resource.kind, resource.version].join("/"),
  );

  log.info(`Found ${resources.length} resources`, { resourceTypes });

  return resources;
};
