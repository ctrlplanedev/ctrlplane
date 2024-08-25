import { z } from "zod";

export const configFile = z.object({
  deployments: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      system: z.string(),
      workspace: z.string(),
    }),
  ),
});
