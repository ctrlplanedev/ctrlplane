import { z } from "zod";

import { clusterConfig } from "./kubernetes-cluster.js";

export const kubernetesNamespaceV1 = z.object({
  version: z.literal("compute.ctrlplane.dev/v1"),
  kind: z.literal("KubernetesNamespace"),
  identifier: z.string(),
  name: z.string(),
  config: clusterConfig.and(z.object({ namespace: z.string() })),
  metadata: z.record(z.string()).and(
    z
      .object({
        "kubernetes/version": z.string(),
        "kubernetes/status": z
          .literal("running")
          .or(z.literal("unknown"))
          .or(z.literal("creating"))
          .or(z.literal("deleting")),
        "kubernetes/distribution": z.string(),
        "kubernetes/master-version": z.string(),
        "kubernetes/master-version-major": z.string(),
        "kubernetes/master-version-minor": z.string(),
        "kubernetes/master-version-patch": z.string(),
        "kubernetes/autoscaling-enabled": z.string().optional(),
      })
      .partial(),
  ),
});

export type KubernetesNamespaceV1 = z.infer<typeof kubernetesNamespaceV1>;
