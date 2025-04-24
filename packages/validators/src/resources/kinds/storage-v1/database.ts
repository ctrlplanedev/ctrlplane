import { z } from "zod";

import { createKind } from "../create-kind.js";

// Operations: Schema migrations, seeding, connection strings for applications,
// parameters adjustments
export const database = createKind({
  version: "storage.ctrlplane.dev/v1",
  kind: "Database",
  config: z.object({
    name: z.string(),
    engine: z.string(),
    version: z.string(),
    authMethod: z.discriminatedUnion("type", [
      z.object({ type: z.literal("token"), token: z.string() }),
      z.object({
        type: z.literal("aws"),
        region: z.string(),
        clusterIdentifier: z.string(),
        accountId: z.string(),
        username: z.string().optional(),
        password: z.string().optional(),
      }),
      z.object({
        type: z.literal("google"),
        project: z.string(),
        instanceName: z.string(),
        region: z.string(),
        username: z.string().optional(),
        password: z.string().optional(),
      }),
      z.object({
        type: z.literal("azure"),
        resourceGroup: z.string(),
        serverName: z.string(),
        subscriptionId: z.string(),
        username: z.string().optional(),
        password: z.string().optional(),
      }),
      z.object({
        type: z.literal("direct"),
        host: z.string(),
        port: z.number(),
        username: z.string(),
        password: z.string(),
        ssl: z.boolean().optional(),
      }),
    ]),
  }),
  metadata: z
    .object({
      "database/engine": z.string(),
      "database/version": z.string(),
      "database/status": z.string(),
    })
    .partial()
    .passthrough(),
});
