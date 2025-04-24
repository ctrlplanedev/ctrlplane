import { z } from "zod";

import { createKind } from "../create-kind.js";

export const network = createKind({
  version: "network.ctrlplane.dev/v1",
  kind: "Network",
  config: z.object({
    id: z.string(),
    name: z.string(),

    cidr: z.string(),

    provider: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("aws"),
        accountId: z.string(),
        region: z.string(),
      }),
      z.object({
        type: z.literal("azure"),
        subscriptionId: z.string(),
        region: z.string(),
      }),
      z.object({
        type: z.literal("google"),
        project: z.string(),
        region: z.string(),
      }),
    ]),
  }),

  metadata: z.object({
    "network/version": z.string(),
    "network/status": z.string(),
    "network/type": z.string(),
    "network/region": z.string(),
  }),
});
