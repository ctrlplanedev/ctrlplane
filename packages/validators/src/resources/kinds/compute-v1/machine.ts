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
    type: z.literal("google"),
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

export const machine = z.object({
  version: z.literal("compute.ctrlplane.dev/v1"),
  kind: z.literal("Machine"),
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
      "machine/boot-mode": z.enum(["uefi", "bios"]).optional(),
      "machine/architecture": z.enum(["i386", "x86_64", "arm64"]).optional(),
      "machine/type": z.string().optional(),
      "machine/class": z
        .enum([
          "standard", // Balanced performance
          "compute", // CPU optimized
          "memory", // Memory optimized
          "storage", // Storage optimized
          "accelerated", // GPU/FPGA optimized
        ])
        .optional(),
      "machine/cpu-cores": z.string().optional(),
      "machine/cpu-threads-per-core": z.string().optional(),
      "machine/cpu-threads": z.string().optional(),
    }),
  ),
});

export type MachineV1 = z.infer<typeof machine>;
