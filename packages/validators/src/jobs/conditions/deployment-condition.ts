import { z } from "zod";

export const deploymentCondition = z.object({
  type: z.literal("deployment"),
  operator: z.literal("equals"),
  value: z.string().uuid(),
});

export type DeploymentCondition = z.infer<typeof deploymentCondition>;
