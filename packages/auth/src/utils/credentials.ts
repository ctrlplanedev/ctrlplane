import { verifySync } from "@node-rs/bcrypt";

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
  if (user == null) return new Error("Invalid credentials");
  const { passwordHash } = user;
  if (passwordHash == null) return new Error("Invalid credentials");
  const isPasswordCorrect = verifySync(password, passwordHash);
  return isPasswordCorrect ? user : new Error("Invalid credentials");
};
