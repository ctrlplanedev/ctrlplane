import { z } from "zod";

import { createKind } from "../create-kind.js";

const portForwardingConfig = z.object({
  localPort: z.number(),
  remotePort: z.number(),
  remoteHost: z.string().optional(), // defaults to localhost
});

const authConfig = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("aws"),
    region: z.string(),
    instanceId: z.string(),
    accountId: z.string(),
    username: z.string().optional(),
    portForwarding: portForwardingConfig.optional(),
  }),

  // GCP Connection Methods
  z.object({
    method: z.literal("google"),
    project: z.string(),
    instanceName: z.string(),
    zone: z.string(),
    username: z.string().optional(),
  }),

  // Azure
  z.object({
    method: z.literal("azure"),
    resourceGroup: z.string(),
    vmName: z.string(),
    subscriptionId: z.string(),
    username: z.string().optional(),
  }),

  // On-Prem / Generic Connection Methods
  z.object({
    method: z.literal("ssh"),
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

export const machine = createKind({
  version: "compute.ctrlplane.dev/v1",
  kind: "Machine",
  config: z.object({
    id: z.string(),
    name: z.string(),
    auth: authConfig,
  }),

  metadata: z
    .object({
      "machine/boot-mode": z.enum(["uefi", "bios"]),
      "machine/architecture": z.enum(["i386", "x86_64", "arm64"]),
      "machine/type": z.string(),
      "machine/class": z.enum([
        "standard", // Balanced performance
        "compute", // CPU optimized
        "memory", // Memory optimized
        "storage", // Storage optimized
        "accelerated", // GPU/FPGA optimized
      ]),
      "machine/cpu-cores": z.string(),
      "machine/cpu-threads-per-core": z.string(),
      "machine/cpu-threads": z.string(),
    })
    .partial()
    .passthrough(),
});

export type MachineV1 = z.infer<typeof machine>;
