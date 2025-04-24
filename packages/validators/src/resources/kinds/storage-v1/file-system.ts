import { z } from "zod";

import { createKind } from "../create-kind.js";

export const fileSystem = createKind({
  version: "storage.ctrlplane.dev/v1",
  kind: "FileSystem",
  config: z.object({
    name: z.string(),
    region: z.string(),
    accessKey: z.string(),
    secretKey: z.string(),
  }),
  metadata: z
    .object({
      "file-system/version": z.string(),
    })
    .partial()
    .passthrough(),
});
