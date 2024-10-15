import { z } from "zod";

export const release = z.object({
  name: z.string().optional(),
  config: z.record(z.any()).optional(),
  metadata: z.record(z.string()).optional(),
});

export const deployment = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  releases: z.array(release).optional(),
  jobAgent: z.object({ id: z.string(), config: z.record(z.any()) }).optional(),
});

export const system = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export const cacV1 = z.object({
  version: z.literal("v1"),

  workspace: z.string(),

  systems: z.record(system).optional(),
  deployments: z.record(deployment).optional(),
  releases: z.record(release).optional(),
});
export type CacV1 = z.infer<typeof cacV1>;
