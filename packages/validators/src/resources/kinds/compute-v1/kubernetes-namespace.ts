import { z } from "zod";

import { createKind } from "../create-kind.js";
import { clusterConfig } from "./kubernetes-cluster.js";

export const kubernetesNamespaceV1 = createKind({
  version: "compute.ctrlplane.dev/v1",
  kind: "KubernetesNamespace",
  config: clusterConfig.extend({
    namespace: z.string(),
  }),
  metadata: z
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
      "kubernetes/autoscaling-enabled": z.string(),
    })
    .partial()
    .passthrough(),
});

export type KubernetesNamespaceV1 = z.infer<typeof kubernetesNamespaceV1>;
