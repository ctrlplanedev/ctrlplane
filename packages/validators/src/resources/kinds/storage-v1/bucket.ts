import { z } from "zod";

import { createKind } from "../create-kind.js";

// Operations: File storage, backup, static hosting
export const bucket = createKind({
  version: "storage.ctrlplane.dev/v1",
  kind: "Bucket",
  config: z.object({
    name: z.string(),
    region: z.string(),

    provider: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("aws"),
        accountId: z.string(),
        region: z.string(),
        accessKey: z.string(),
        secretKey: z.string(),
        endpoint: z.string().url().optional(),
      }),
      z.object({
        type: z.literal("google"),
        project: z.string(),
        region: z.string(),
        serviceAccountKey: z.string(),
      }),
      z.object({
        type: z.literal("azure"),
        storageAccount: z.string(),
        resourceGroup: z.string(),
        subscriptionId: z.string(),
        accessKey: z.string(),
      }),
      z.object({
        type: z.literal("s3compatible"),
        endpoint: z.string().url(),
        accessKey: z.string(),
        secretKey: z.string(),
        region: z.string().optional(),
      }),
    ]),

    encryption: z
      .object({
        enabled: z.boolean(),
        type: z.enum(["SSE-S3", "SSE-KMS", "SSE-C"]).optional(),
        kmsKeyId: z.string().optional(),
        customerKey: z.string().optional(),
      })
      .optional(),
  }),
  metadata: z
    .object({
      "bucket/version": z.string(),
      "bucket/status": z.string(),
      "bucket/type": z.string(),
      "bucket/region": z.string(),
      "bucket/encryption": z.string(),
    })
    .partial()
    .passthrough(),
});
