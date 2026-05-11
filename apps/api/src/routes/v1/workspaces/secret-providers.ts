import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { z } from "zod";

import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";

const awsSecretsManagerConfig = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().min(1).optional(),
  secretAccessKey: z.string().min(1).optional(),
});

const dopplerConfig = z.object({
  serviceToken: z.string().startsWith("dp.st."),
});

const envConfig = z.object({
  allowedKeys: z
    .array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/))
    .min(1),
});

const providerBody = z.discriminatedUnion("type", [
  z.object({
    name: z.string().min(1),
    type: z.literal("aws_secrets_manager"),
    config: awsSecretsManagerConfig,
  }),
  z.object({
    name: z.string().min(1),
    type: z.literal("doppler"),
    config: dopplerConfig,
  }),
  z.object({
    name: z.string().min(1),
    type: z.literal("env"),
    config: envConfig,
  }),
]);

const formatSecretProvider = (
  row: typeof schema.secretProvider.$inferSelect,
) => ({
  id: row.id,
  workspaceId: row.workspaceId,
  name: row.name,
  type: row.type,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const listSecretProviders: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/secret-providers",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.secretProvider)
    .where(eq(schema.secretProvider.workspaceId, workspaceId));

  const total = countResult?.total ?? 0;

  const items = await db
    .select()
    .from(schema.secretProvider)
    .where(eq(schema.secretProvider.workspaceId, workspaceId))
    .limit(limit)
    .offset(offset);

  res
    .status(200)
    .json({ items: items.map(formatSecretProvider), total, limit, offset });
};

const getSecretProvider: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
  "get"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;

  const row = await db.query.secretProvider.findFirst({
    where: and(
      eq(schema.secretProvider.id, providerId),
      eq(schema.secretProvider.workspaceId, workspaceId),
    ),
  });

  if (row == null) throw new ApiError("Secret provider not found", 404);

  res.status(200).json(formatSecretProvider(row));
};

const upsertSecretProvider: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
  "put"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;

  const parsed = providerBody.safeParse(req.body);
  if (!parsed.success)
    throw new ApiError(
      `Invalid secret provider body: ${parsed.error.message}`,
      400,
    );

  const { name, type, config } = parsed.data;
  const encryptedConfig = Buffer.from(
    variablesAES256().encrypt(JSON.stringify(config)),
    "utf8",
  );

  await db
    .insert(schema.secretProvider)
    .values({
      id: providerId,
      workspaceId,
      name,
      type,
      config: encryptedConfig,
    })
    .onConflictDoUpdate({
      target: schema.secretProvider.id,
      set: {
        name,
        type,
        config: encryptedConfig,
        updatedAt: new Date(),
      },
    });

  res.status(202).json({
    id: providerId,
    message: "Secret provider upsert requested",
  });
};

const deleteSecretProvider: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;

  const [deleted] = await db
    .delete(schema.secretProvider)
    .where(
      and(
        eq(schema.secretProvider.id, providerId),
        eq(schema.secretProvider.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (deleted == null) throw new ApiError("Secret provider not found", 404);

  res
    .status(202)
    .json({ id: providerId, message: "Secret provider deleted" });
};

export const secretProvidersRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listSecretProviders))
  .get("/:providerId", asyncHandler(getSecretProvider))
  .put("/:providerId", asyncHandler(upsertSecretProvider))
  .delete("/:providerId", asyncHandler(deleteSecretProvider));
