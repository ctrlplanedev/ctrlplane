import { z } from "zod";

export const clusterApi = z.object({
  version: z.literal("kubernetes/v1"),
  kind: z.literal("ClusterAPI"),
  name: z.string(),
  provider: z.string(),
  config: z.object({
    name: z.string(),
    server: z.object({
      certificateAuthorityData: z.string(),
      server: z.string().url(),
    }),
  }),
  labels: z.record(z.string()).and(
    z
      .object({
        "kubernetes.io/version": z.string(),
      })
      .partial(),
  ),
});

export type ClusterAPI = z.infer<typeof clusterApi>;
