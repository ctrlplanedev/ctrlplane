import { z } from "zod";

export const instance = z.object({
  version: z.literal("application/v1"),
  kind: z.literal("Instance"),
  name: z.string(),
  provider: z.string(),
  config: z.object({
    identifier: z.string(),
    inputs: z.array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    ),
  }),
  labels: z.record(z.string()).and(z.object({})),
});

export type Instance = z.infer<typeof instance>;
