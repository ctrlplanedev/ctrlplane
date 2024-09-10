import crypto from "node:crypto";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { user, userApiKey } from "@ctrlplane/db/schema";

export const generateApiKey = () => {
  const prefix = crypto.randomBytes(8).toString("hex"); // Public part
  const secret = crypto.randomBytes(32).toString("hex"); // Secret part
  const apiKey = `${prefix}.${secret}`;
  return { apiKey, prefix, secret };
};

export const hash = (key: string) =>
  crypto.createHash("sha256").update(key).digest("hex");

export const getUser = async (apiKey: string) => {
  const [prefix, key] = apiKey.split(".");
  if (prefix == null || key == null) return null;

  const hashKey = hash(key);
  const apiKeyEntry = await db
    .select()
    .from(userApiKey)
    .innerJoin(user, eq(userApiKey.userId, user.id))
    .where(
      and(eq(userApiKey.keyPrefix, prefix), eq(userApiKey.keyHash, hashKey)),
    )
    .then(takeFirstOrNull);

  if (!apiKeyEntry) return null;

  const { user_api_key: keyEntry, user: keyUser } = apiKeyEntry;
  if (keyEntry.expiresAt && keyEntry.expiresAt < new Date()) return null;

  return keyUser;
};
