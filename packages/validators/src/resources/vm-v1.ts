import { z } from "zod";

const diskV1 = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  encrypted: z.boolean(),
});

export const vmV1 = z.object({
  workspaceId: z.string(),
  providerId: z.string(),
  version: z.literal("vm/v1"),
  kind: z.literal("VM"),
  identifier: z.string(),
  name: z.string(),
  config: z
    .object({
      name: z.string(),
      id: z.string(),
      disks: z.array(diskV1),
      type: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("google"),
          project: z.string(),
          zone: z.string(),
        }),
      ]),
    })
    .passthrough(),
  metadata: z
    .record(z.string())
    .and(z.object({ "vm/machine-type": z.string().optional() })),
});

export type VmV1 = z.infer<typeof vmV1>;
