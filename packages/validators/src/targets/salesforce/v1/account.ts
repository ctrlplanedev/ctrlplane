import { z } from "zod";

export const account = z.object({
  version: z.literal("salesfroce/v1"),
  kind: z.literal("Account"),
  name: z.string(),
  provider: z.string(),
  config: z.object({
    id: z.string(),
    name: z.string(),
    industry: z.string(),
    active: z.boolean(),
    nps: z.string(),
  }),
  labels: z.record(z.string()).and(
    z
      .object({
        "naics.com/code": z.string(),
      })
      .partial(),
  ),
});

export type Account = z.infer<typeof account>;
