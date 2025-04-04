import type { Credentials } from "@aws-sdk/client-sts";
import type { AwsCredentialIdentity } from "@smithy/types";
import { EC2Client } from "@aws-sdk/client-ec2";
import { EKSClient } from "@aws-sdk/client-eks";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

const sourceClient = new STSClient({ region: "us-east-1" });

export class AwsCredentials {
  static from(credentials: Credentials) {
    return new AwsCredentials(credentials);
  }

  private constructor(private readonly credentials: Credentials) {}

  toIdentity(): AwsCredentialIdentity {
    if (
      this.credentials.AccessKeyId == null ||
      this.credentials.SecretAccessKey == null
    )
      throw new Error("Missing required AWS credentials");

    return {
      accessKeyId: this.credentials.AccessKeyId,
      secretAccessKey: this.credentials.SecretAccessKey,
      sessionToken: this.credentials.SessionToken ?? undefined,
    };
  }

  ec2(region?: string) {
    return new EC2Client({ region, credentials: this.toIdentity() });
  }

  eks(region?: string) {
    return new EKSClient({ region, credentials: this.toIdentity() });
  }

  sts(region?: string) {
    return new STSClient({ region, credentials: this.toIdentity() });
  }
}

export const assumeWorkspaceRole = async (roleArn: string) =>
  assumeRole(sourceClient, roleArn);

export const assumeRole = async (
  client: STSClient,
  roleArn: string,
): Promise<AwsCredentials> => {
  const { Credentials: CustomerCredentials } = await client.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "CtrlplaneScanner",
    }),
  );
  if (CustomerCredentials == null)
    throw new Error(`Failed to assume AWS role ${roleArn}`);
  return AwsCredentials.from(CustomerCredentials);
};
