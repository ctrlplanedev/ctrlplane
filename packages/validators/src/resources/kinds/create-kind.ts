import { z } from "zod";

export const createKind = <
  Config extends z.ZodObject<any>,
  Metadata extends z.ZodObject<any>,
>(obj: {
  version: string;
  kind: string;
  config: Config;
  metadata: Metadata;
}) => {
  return z.object({
    identifier: z.string(),
    name: z.string(),

    version: z.literal(obj.version),
    kind: z.literal(obj.kind),

    config: obj.config,
    metadata: obj.metadata,
  });
};
