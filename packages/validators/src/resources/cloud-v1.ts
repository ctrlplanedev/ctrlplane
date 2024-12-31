import { z } from "zod";

export const cloudVpcV1 = z.object({
  version: z.literal("cloud/v1"),
  kind: z.literal("VPC"),
  identifier: z.string(),
  name: z.string(),
  config: z.object({
    name: z.string(),
    id: z.string().optional(), // For AWS
    provider: z.enum(["aws", "azure", "google"]),
    region: z.string().optional(),
    project: z.string().optional(), // For Google Cloud
    accountId: z.string().optional(), // For AWS
    cidr: z.string().optional(),
    mtu: z.number().optional(),
    subnets: z
      .array(
        z.object({
          name: z.string(),
          region: z.string(),
          cidr: z.string().optional(),
          type: z
            .enum([
              "public", // for AWS
              "private",
              "internal", // for GCP
              "external",
            ])
            .optional(),
          gatewayAddress: z.string().optional(), // for GCP
          availabilityZone: z.string().optional(),
          secondaryCidrs: z // for GCP
            .array(z.object({ name: z.string(), cidr: z.string() }))
            .optional(),
        }),
      )
      .optional(),
    secondaryCidrs: z // for AWS
      .array(z.object({ cidr: z.string(), state: z.string() }))
      .optional(),
  }),
  metadata: z.record(z.string()).and(z.object({}).partial()),
});

export type CloudVPCV1 = z.infer<typeof cloudVpcV1>;
