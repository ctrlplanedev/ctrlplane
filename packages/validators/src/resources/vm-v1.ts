import type { ZodError } from "zod";
import { z } from "zod";

import type { Identifiable } from "./util";
import { getSchemaParseError } from "./util.js";

const diskV1 = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  encrypted: z.boolean(),
});

const version = "vm/v1";
const kind = "VM";

export const vmV1 = z.object({
  workspaceId: z.string(),
  providerId: z.string(),
  version: z.literal(version),
  kind: z.literal(kind),
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

export const getVmV1SchemaParseError = (obj: object): ZodError | undefined =>
  getSchemaParseError(
    obj,
    (identifiable: Identifiable) =>
      identifiable.kind === kind && identifiable.version === version,
    vmV1,
  );
