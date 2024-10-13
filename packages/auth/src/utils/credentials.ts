import { compareSync } from "bcryptjs";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

const getUserByEmail = (email: string) =>
  db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .then(takeFirstOrNull);

export const getUserByCredentials = async (email: string, password: string) => {
  const user = await getUserByEmail(email);
  if (user == null) return null;
  const { passwordHash } = user;
  if (passwordHash == null) return null;
  return compareSync(password, passwordHash) ? user : null;
};
