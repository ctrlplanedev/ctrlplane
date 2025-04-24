import { z } from "zod";

export const createKind = (obj: {
  version: string;
  kind: string;
  config: z.ZodObject<any, any, any, any, any>;
  metadata: z.ZodObject<any, any, any, any, any>;
}) => {
  return z.object({
    version: z.literal(obj.version),
    kind: z.literal(obj.kind),
    config: obj.config.passthrough(),
    metadata: obj.metadata.passthrough(),
  });
};
