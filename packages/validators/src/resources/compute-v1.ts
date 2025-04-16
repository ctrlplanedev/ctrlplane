import { z } from "zod";

const portForwardingConfig = z.object({
  localPort: z.number(),
  remotePort: z.number(),
  remoteHost: z.string().optional(), // defaults to localhost
});

const connectionMethodConfig = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("aws"),
    region: z.string(),
    instanceId: z.string(),
    accountId: z.string(),
    username: z.string().optional(),
    portForwarding: portForwardingConfig.optional(),
  }),

  // GCP Connection Methods
  z.object({
    type: z.literal("gcp"),
    project: z.string(),
    instanceName: z.string(),
    zone: z.string(),
    username: z.string().optional(),
  }),

  // Azure
  z.object({
    type: z.literal("azure"),
    resourceGroup: z.string(),
    vmName: z.string(),
    subscriptionId: z.string(),
    username: z.string().optional(),
  }),

  // On-Prem / Generic Connection Methods
  z.object({
    type: z.literal("ssh"),
    host: z.string(),
    port: z.number().default(22),
    username: z.string(),
    auth: z.discriminatedUnion("method", [
      z.object({
        method: z.literal("key"),
        privateKeyPath: z.string(),
        passphrase: z.string().optional(),
      }),
      z.object({
        method: z.literal("password"),
        password: z.string(),
      }),
      z.object({
        method: z.literal("agent"),
        agentSocket: z.string().optional(),
      }),
    ]),
  }),
]);

export const instanceV1 = z.object({
  workspaceId: z.string(),
  providerId: z.string(),
  version: z.literal("compute/v1"),
  kind: z.literal("Instance"),
  identifier: z.string(),
  name: z.string(),

  config: z
    .object({
      id: z.string(),
      name: z.string(),
      connectionMethod: connectionMethodConfig,
    })
    .passthrough(),

  metadata: z.record(z.string()).and(
    z.object({
      "compute/test": z.string().optional(),
      "compute/boot-mode": z.enum(["uefi", "bios"]).optional(),
      "compute/architecture": z.enum(["i386", "x86_64", "arm64"]).optional(),
      "compute/machine-type": z.string().optional(),
      "compute/type": z
        .enum([
          "standard", // Balanced performance
          "compute", // CPU optimized
          "memory", // Memory optimized
          "storage", // Storage optimized
          "accelerated", // GPU/FPGA optimized
        ])
        .optional(),
      "compute/cpu-cores": z.string().optional(),
      "compute/cpu-threads-per-core": z.string().optional(),
      "compute/cpu-threads": z.string().optional(),
    }),
  ),
});

export type InstanceV1 = z.infer<typeof instanceV1>;
