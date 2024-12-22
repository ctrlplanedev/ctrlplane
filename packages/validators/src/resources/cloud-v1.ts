import { z } from "zod";

export const cloudVpcV1 = z.object({
  version: z.literal("cloud/v1"),
  kind: z.literal("VPC"),
  identifier: z.string(),
  name: z.string(),
  config: z.object({
    name: z.string(),
    provider: z.enum(["aws", "azure", "google"]),
    region: z.string().optional(),
    project: z.string().optional(), // For Google Cloud
    cidr: z.string().optional(),
    mtu: z.number().optional(),
    subnets: z
      .array(z.object({ name: z.string(), region: z.string() }))
      .optional(),
  }),
  metadata: z.record(z.string()).and(z.object({}).partial()),
});

export type CloudVPCV1 = z.infer<typeof cloudVpcV1>;
