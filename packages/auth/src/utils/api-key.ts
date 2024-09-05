import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

import { takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { user, userApiKey } from "@ctrlplane/db/schema";

import { accessQuery } from "./access-query";

export const getUser = async (apiKey: string) => {
  const keyHash = await hash(apiKey, 10);
  const apiKeyEntry = await db
    .select()
    .from(userApiKey)
    .innerJoin(user, eq(userApiKey.userId, user.id))
    .where(eq(userApiKey.keyHash, keyHash))
    .then(takeFirstOrNull);

  if (!apiKeyEntry) return { access: accessQuery(db) };

  const { user_api_key: keyEntry, user: keyUser } = apiKeyEntry;
  if (keyEntry.expiresAt && keyEntry.expiresAt < new Date())
    return { access: accessQuery(db) };

  return { access: accessQuery(db, keyUser.id), user: keyUser };
};
