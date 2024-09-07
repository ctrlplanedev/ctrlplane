import { hash } from "bcryptjs";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { user, userApiKey } from "@ctrlplane/db/schema";

export const getUser = async (apiKey: string) => {
  const keyHash = await hash(apiKey, 10);
  const apiKeyEntry = await db
    .select()
    .from(userApiKey)
    .innerJoin(user, eq(userApiKey.userId, user.id))
    .where(eq(userApiKey.keyHash, keyHash))
    .then(takeFirstOrNull);

  if (!apiKeyEntry) return null;

  const { user_api_key: keyEntry, user: keyUser } = apiKeyEntry;
  if (keyEntry.expiresAt && keyEntry.expiresAt < new Date()) return null;

  return keyUser;
};
