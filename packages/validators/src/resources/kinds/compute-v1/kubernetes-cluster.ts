import { z } from "zod";

import { createKind } from "../create-kind.js";

export const clusterConfig = z.object({
  name: z.string(),
  server: z.object({
    certificateAuthorityData: z.string().nullish(),
    endpoint: z.string().url(),
  }),
  vcluster: z.string().optional(),
  connectionMethod: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("token"),
      token: z.string(),
    }),
    z.object({
      type: z.literal("google"),
      project: z.string(),
      location: z.string(),
      clusterName: z.string(),
    }),
    z.object({
      type: z.literal("aws"),
      region: z.string(),
      clusterName: z.string(),
      accountId: z.string(),
    }),
    z.object({
      type: z.literal("azure"),
      resourceGroup: z.string(),
      clusterName: z.string(),
      tenantId: z.string(),
      subscriptionId: z.string(),
    }),
    z.object({
      type: z.literal("exec"),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
    }),
    z.object({
      type: z.literal("kubeconfig"),
      path: z.string(),
      context: z.string().optional(),
    }),
  ]),
});

export const kubernetesClusterV1 = createKind({
  version: "compute.ctrlplane.dev/v1",
  kind: "KubernetesCluster",
  config: clusterConfig,
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
    .partial(),
});

export type KubernetesClusterV1 = z.infer<typeof kubernetesClusterV1>;
