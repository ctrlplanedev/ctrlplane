import { z } from "zod";

const clusterConfig = z.object({
  name: z.string(),
  status: z.string().optional(),
  server: z.object({
    certificateAuthorityData: z.string().nullish(),
    endpoint: z.string().url(),
  }),
  auth: z.discriminatedUnion("method", [
    z.object({
      method: z.literal("token"),
      token: z.string(),
    }),
    z.object({
      method: z.literal("google/gke"),
      project: z.string(),
      location: z.string(),
      clusterName: z.string(),
    }),
    z.object({
      method: z.literal("aws/eks"),
      region: z.string(),
      clusterName: z.string(),
    }),
    z.object({
      method: z.literal("azure/aks"),
      resourceGroup: z.string(),
      clusterName: z.string(),
    }),
    z.object({
      method: z.literal("exec"),
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
      method: z.literal("kubeconfig"),
      path: z.string(),
      context: z.string().optional(),
    }),
  ]),
});

export const kubernetesClusterApiV1 = z.object({
  version: z.literal("kubernetes/v1"),
  kind: z.literal("ClusterAPI"),
  identifier: z.string(),
  name: z.string(),
  config: clusterConfig,
  metadata: z.record(z.string()).and(
    z
      .object({
        "kubernetes/version": z.string(),
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

export type KubernetesClusterAPIV1 = z.infer<typeof kubernetesClusterApiV1>;

export const kubernetesNamespaceV1 = z.object({
  version: z.literal("kubernetes/v1"),
  kind: z.literal("Namespace"),
  identifier: z.string(),
  name: z.string(),
  config: clusterConfig.and(z.object({ namespace: z.string() })),
  metadata: z.record(z.string()).and(z.object({}).partial()),
});

export type KubernetesNamespaceV1 = z.infer<typeof kubernetesNamespaceV1>;
