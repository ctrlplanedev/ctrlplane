import type { EKSClient } from "@aws-sdk/client-eks";
import type { Credentials } from "@aws-sdk/client-sts";
import { EKSClient as EKSClientImpl } from "@aws-sdk/client-eks";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

import { logger } from "@ctrlplane/logger";

const log = logger.child({ label: "resource-scan/aws" });

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

export const getAssumedClient = async (roleArn: string): Promise<AwsClient> => {
  const { Credentials } = await sourceClient.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "CtrlplaneScanner",
    }),
  );

  if (!Credentials) throw new Error("Failed to assume AWS role");

  return {
    credentials: Credentials,
    eksClient: createEksClient("us-east-1", Credentials),
  };
};

export const getClient = async (
  targetRole?: string | null,
): Promise<AwsClient> => {
  try {
    if (targetRole == null) throw new Error("AWS Role ARN is required");

    return await getAssumedClient(targetRole);
  } catch (error: any) {
    log.error(`Failed to get AWS Client: ${error.message}`, {
      error,
    });
    throw error;
  }
};
