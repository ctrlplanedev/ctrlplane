import type { EKSClient } from "@aws-sdk/client-eks";
import type { Credentials } from "@aws-sdk/client-sts";
import { EKSClient as EKSClientImpl } from "@aws-sdk/client-eks";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

import { logger } from "@ctrlplane/logger";

const log = logger.child({ label: "resource-scan/aws" });

let workspaceCredentials: Credentials | undefined;
const initializeWorkspaceCredentials = async (roleArn: string) => {
  const { Credentials } = await sourceClient.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "CtrlplaneScanner",
    }),
  );
  if (!Credentials) throw new Error("Failed to assume AWS role");
  workspaceCredentials = Credentials;
};

export type AwsClient = {
  eksClient: EKSClient;
  credentials: Credentials;
};

const sourceClient = new STSClient({ region: "us-east-1" });

export const createEksClient = (
  region: string,
  credentials: Credentials,
): EKSClient => {
  return new EKSClientImpl({
    region,
    credentials: {
      accessKeyId: credentials.AccessKeyId!,
      secretAccessKey: credentials.SecretAccessKey!,
      sessionToken: credentials.SessionToken,
    },
  });
};

export const getAssumedClient = async (
  workspaceRoleArn: string,
  customerRoleArn: string,
): Promise<AwsClient> => {
  if (workspaceCredentials == null)
    await initializeWorkspaceCredentials(workspaceRoleArn);

  const finalClient = new STSClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: workspaceCredentials!.AccessKeyId!,
      secretAccessKey: workspaceCredentials!.SecretAccessKey!,
      sessionToken: workspaceCredentials!.SessionToken,
    },
  });

  const { Credentials: CustomerCredentials } = await finalClient.send(
    new AssumeRoleCommand({
      RoleArn: customerRoleArn,
      RoleSessionName: "CtrlplaneScanner",
    }),
  );

  if (CustomerCredentials == null)
    throw new Error(`Failed to assume AWS role ${customerRoleArn}`);

  return {
    credentials: CustomerCredentials,
    eksClient: createEksClient("us-east-1", CustomerCredentials),
  };
};

export const createAwsClient = async (
  workspaceRoleArn?: string | null,
  customerRoleArn?: string,
): Promise<AwsClient> => {
  try {
    if (workspaceRoleArn == null)
      throw new Error(
        "AWS workspace role arn is required, please configure it at the workspace.",
      );
    if (customerRoleArn == null)
      throw new Error("AWS customer role arn is required");

    return await getAssumedClient(workspaceRoleArn, customerRoleArn);
  } catch (error: any) {
    log.error(`Failed to get AWS Client: ${error.message}`, {
      error,
      customerRoleArn,
    });
    throw error;
  }
};
