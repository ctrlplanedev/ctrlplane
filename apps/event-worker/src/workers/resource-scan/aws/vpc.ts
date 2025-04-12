import type { Vpc } from "@aws-sdk/client-ec2";
import type { STSClient } from "@aws-sdk/client-sts";
import type { ResourceProviderAws, Workspace } from "@ctrlplane/db/schema";
import type { CloudVPCV1 } from "@ctrlplane/validators/resources";
import {
  DescribeRegionsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
} from "@aws-sdk/client-ec2";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { AwsCredentials } from "./aws.js";
import { omitNullUndefined } from "../../../utils/omit-null-undefined.js";
import { assumeRole, assumeWorkspaceRole } from "./aws.js";

const log = logger.child({ label: "resource-scan/aws/vpc" });

const convertVpcToCloudResource = (
  accountId: string,
  region: string,
  vpc: Vpc,
  subnets: {
    name: string;
    region: string;
    cidr: string;
    type: "public" | "private";
    availabilityZone?: string;
  }[] = [],
): CloudVPCV1 => {
  const partition = region.startsWith("us-gov-") ? "aws-us-gov" : "aws";
  const appUrl = `https://${
    partition === "aws-us-gov"
      ? `console.${region}.${partition}`
      : "console.aws.amazon"
  }.com/vpcconsole/home?region=${region}#vpcs:search=${vpc.VpcId}`;

  const name = vpc.Tags?.find((tag) => tag.Key === "Name")?.Value ?? vpc.VpcId!;

  return {
    name,
    identifier: `aws/${accountId}/vpc/${vpc.VpcId}`,
    version: "cloud/v1",
    kind: "VPC",
    config: {
      name,
      id: vpc.VpcId!,
      provider: "aws",
      region,
      accountId: accountId,
      cidr: vpc.CidrBlock,
      subnets,
      secondaryCidrs: vpc.CidrBlockAssociationSet?.filter(
        (assoc) => assoc.CidrBlock !== vpc.CidrBlock,
      ).map((assoc) => ({
        cidr: assoc.CidrBlock ?? "",
        state: assoc.CidrBlockState?.State?.toLowerCase() ?? "",
      })),
    },
    metadata: omitNullUndefined({
      [ReservedMetadataKey.ExternalId]: vpc.VpcId,
      [ReservedMetadataKey.Links]: JSON.stringify({ "AWS Console": appUrl }),
      "aws/region": region,
      "aws/state": vpc.State,
      "aws/is-default": vpc.IsDefault,
      "aws/dhcp-options-id": vpc.DhcpOptionsId,
      "aws/instance-tenancy": vpc.InstanceTenancy,
      ...(vpc.Tags?.reduce(
        (acc, tag) => ({
          ...acc,
          [`aws/tag/${tag.Key}`]: tag.Value,
        }),
        {},
      ) ?? {}),
    }),
  };
};

const getAwsRegions = async (credentials: AwsCredentials) =>
  credentials
    .ec2()
    .send(new DescribeRegionsCommand({}))
    .then(({ Regions = [] }) => Regions.map((region) => region.RegionName));

const getVpcs = async (client: AwsCredentials, region: string) => {
  const ec2Client = client.ec2(region);
  const { Vpcs = [] } = await ec2Client.send(new DescribeVpcsCommand({}));
  return Vpcs;
};

const getSubnets = async (
  client: AwsCredentials,
  region: string,
  vpcId: string,
): Promise<
  {
    name: string;
    region: string;
    cidr: string;
    type: "public" | "private";
    availabilityZone: string;
  }[]
> => {
  const ec2Client = client.ec2(region);
  const { Subnets = [] } = await ec2Client.send(
    new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );
  return Subnets.map((subnet) => ({
    name: subnet.SubnetId ?? "",
    region,
    cidr: subnet.CidrBlock ?? "",
    type: subnet.MapPublicIpOnLaunch ? "public" : "private",
    availabilityZone: subnet.AvailabilityZone ?? "",
  }));
};

const createVpcScannerForRegion = (
  client: AwsCredentials,
  customerRoleArn: string,
) => {
  const accountId = /arn:aws:iam::(\d+):/.exec(customerRoleArn)?.[1];
  if (accountId == null) throw new Error("Missing account ID");

  return async (region: string) => {
    const vpcs = await getVpcs(client, region);
    log.info(
      `Found ${vpcs.length} VPCs for ${customerRoleArn} in region ${region}`,
    );

    const vpcResources = await Promise.all(
      vpcs.map(async (vpc) => {
        if (!vpc.VpcId) return null;
        const subnets = await getSubnets(client, region, vpc.VpcId);
        return convertVpcToCloudResource(accountId, region, vpc, subnets);
      }),
    );

    return vpcResources.filter(isPresent);
  };
};

const scanVpcsByAssumedRole = async (
  workspaceClient: STSClient,
  customerRoleArn: string,
) => {
  const client = await assumeRole(workspaceClient, customerRoleArn);
  const regions = await getAwsRegions(client);

  log.info(
    `Scanning ${regions.length} AWS regions for VPCs in account ${customerRoleArn}`,
  );

  const regionalVpcScanner = createVpcScannerForRegion(client, customerRoleArn);

  return _.chain(regions)
    .filter(isPresent)
    .map(regionalVpcScanner)
    .thru((promises) => Promise.all(promises))
    .value()
    .then((results) => results.flat());
};

export const getVpcResources = async (
  workspace: Workspace,
  config: ResourceProviderAws,
) => {
  if (!config.importVpc) return [];

  const { awsRoleArn: workspaceRoleArn } = workspace;
  if (workspaceRoleArn == null) return [];

  log.info(
    `Scanning for VPCs with assumed role arns ${config.awsRoleArns.join(", ")} using role ${workspaceRoleArn}`,
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
      scanVpcsByAssumedRole(workspaceStsClient, customerRoleArn),
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

  log.info(`Found ${resources.length} VPC resources`);

  return resources;
};
