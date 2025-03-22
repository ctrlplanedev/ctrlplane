import { z } from "zod";

export const versionCondition = z.object({
  type: z.literal("version"),
  operator: z.literal("equals"),
  value: z.string().min(1),
});

export type VersionCondition = z.infer<typeof versionCondition>;
