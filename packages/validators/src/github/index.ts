import { z } from "zod";

export const configSchema = z.object({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  workflowId: z.number(),
});
