import { z } from "zod";

export const workspace = z.object({
  version: z.literal("terraform/v1"),
  kind: z.literal("Workspace"),
  name: z.string(),
  provider: z.string(),
  config: z.object({
    backend: z.literal("terraform-cloud"),
    terraformVersion: z.string(),
    inputs: z.array(
      z.object({
        key: z.string(),
        value: z.string(),
        default: z.string().optional(),
        category: z.literal("hcl").or(z.literal("env")).default("hcl"),
        required: z.boolean().default(false),
        sensitive: z.boolean().default(false),
      }),
    ),
  }),
  labels: z.record(z.string()).and(
    z
      .object({
        "terraform.io/organization": z.string(),
        "terraform.io/workspace": z.string(),
      })
      .partial(),
  ),
});

export type Workspace = z.infer<typeof workspace>;
